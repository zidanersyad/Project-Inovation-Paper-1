"""
INTEGRATED AI ASSIGNMENT SYSTEM
Menggabungkan CRI (Composite Risk Index) dan TSM (Talent Scoring Model)
untuk assignment engineer yang optimal berdasarkan kompleksitas permintaan
"""

import requests
import pandas as pd
import numpy as np
import re
import string
from pathlib import Path
from datetime import datetime, time, timedelta
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import RobustScaler, MinMaxScaler
from scipy.sparse import csr_matrix
import joblib
from collections import defaultdict, Counter
from tqdm.auto import tqdm
import warnings
warnings.filterwarnings('ignore')

import nltk
nltk.download('stopwords', quiet=True)
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

from nltk.corpus import stopwords
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory

# =============================================================================
# CONFIGURATION
# =============================================================================
CONFIG = {
    'base_url': 'http://localhost:3000/api',
    'data_olah': 'Data Olah.csv',
    'data_cri': 'Data CRI Final.csv',
    'min_df': 3,
    'max_df': 0.95,
    'top_n_tags': 8,
    'top_k_candidates': 5,  # Top 5 engineers dari TSM
    'frequency_weight': 0.7,
    'relative_weight': 0.3,
    # Bobot TSM
    'tsm_weights': {'skill': 0.4, 'seniority': 0.3, 'workload': 0.3},
    # Bobot CRI
    'cri_weights': {
        'complexity': 0.40,
        'urgency': 0.30,
        'dependency': 0.20,
        'likelihood': 0.10
    }
}

# Setup NLP
nltk_stopword = stopwords.words('indonesian')
stopword_id_factory = StopWordRemoverFactory()
sastrawi_stopword = stopword_id_factory.get_stop_words()

additional_stopwords = [
    "nya","sih","mah","r","n","kalo","tuh","ah","b","l","deh","kah","oh","ih","dih","bro","cuy",
    "sa","ya","ok","heh","lo","lu","i","ii","ti","ki","bal","t","al","qur","je","ta","oy","li",
    "h","ar","p","as","hi","v","nge","wkwkwk","dll","nih","ku","a","iii","si","lho","gua","gue",
    "gu","ay","et","opo","ai","un","lol","sus","es","ut","iki","zu","ane","ab","mil","wie","ev",
    "f","kd","st","kar","to","ipo","och","einie","sek","lee","eriii","vii","ile","mi","sel","weh",
    "sb","ra","iin","ske","sur","um","xde","iku","bla","hai","xl","des","duh","we","cc","ag","wan",
    "po","nin","yth","ipu","auch","wes","yaudah","tir","wkwk","wk","mu","les","kor","ppp","au",
    "und","sia","gp","ist","ye","im","ha","hebas","at","pe","bua","qs","bo","ich","they","if",
    "etc","tg","too","als","ngopo","gi","up","ora","ve","kok","go","bv","oi","nom","tr","ui",
    "ana","aku","ahy","kat","tri","iya","tau","kau","bal","an","dah","loh","mbak","e","mak",
    "asa","ayo","ph","vs","wa","xa","jaku","xe","xf","rp","su","ibl","woi","nak","pn","guys",
    "vub","x","aji","my","you","the","this","is","and","of","your","victim","life","why",
    "what","one","no","ber","dm","hehe","he","all","but","okay","just","download","had",
    "hahahaha","niin","walaun","try","xb","ygy","bi","ei","hah","noh","kapai","oke","min",
    "sop","dek","ala","plis","rai","gwe","en","zul","ooo","aing","its","wae","gws","test",
    "bas","by","didu","true","kna","ho","atuh","az","pm","bot","akan","pis","acc","idk",
    "sape","kwa","mohon","minta","ybs","tolong","segera","lanjut","baik"
]

STOPWORDS = list(set(nltk_stopword + sastrawi_stopword + additional_stopwords))

factory = StemmerFactory()
stemmer = factory.create_stemmer()

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================
def find_col(df, candidates):
    """Deteksi kolom berdasarkan kandidat nama"""
    for cand in candidates:
        for c in df.columns:
            if cand.lower() == c.lower().strip():
                return c
    for cand in candidates:
        for c in df.columns:
            if cand.lower() in c.lower():
                return c
    return None

def cleaning_text(text):
    """Membersihkan teks"""
    if pd.isna(text):
        return ""
    text = str(text)
    text = re.sub("@[A-Za-z0-9_]+", "", text)
    text = re.sub(r'''(?i)\b((?:https|http?://|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))\)|[^\s`!()\[\]{};:'".,<>?«»""'']))''', "", text)
    text = re.sub("#[A-Za-z0-9_]+", "", text)
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\d+', '', text)
    text = text.translate(str.maketrans("", "", string.punctuation))
    tokens = text.split()
    
    filtered_tokens = []
    for token in tokens:
        if len(token) > 2:
            has_three_vowels = False
            for i in range(len(token) - 2):
                substring = token[i:i+3]
                if all(char in 'aiueo' for char in substring.lower()):
                    has_three_vowels = True
                    break
            if not has_three_vowels:
                filtered_tokens.append(token)
    
    return " ".join(filtered_tokens)

def preprocess_text(text):
    """Pipeline preprocessing lengkap"""
    text = cleaning_text(text)
    text = text.lower()
    
    # Stopwords removal
    words = text.split()
    words = [word for word in words if word not in STOPWORDS]
    text = ' '.join(words)
    
    # Stemming
    words = text.split()
    words = [stemmer.stem(word) for word in words]
    text = ' '.join(words)
    
    return text

# =============================================================================
# MODULE 1: CRI CALCULATOR
# =============================================================================
class CRICalculator:
    """
    Menghitung Composite Risk Index untuk permintaan baru
    Berdasarkan model yang sudah ditraining dari Data CRI Final.csv
    """
    
    def __init__(self, data_cri_path):
        print("\n" + "="*80)
        print("INITIALIZING CRI CALCULATOR")
        print("="*80)
        
        self.df_cri = pd.read_csv(data_cri_path)
        print(f"✓ Loaded CRI training data: {len(self.df_cri)} records")
        
        # Load atau build scalers
        self._prepare_scalers()
        
        # Load historical stats untuk normalisasi
        self._load_historical_stats()
    
    def _prepare_scalers(self):
        """Prepare RobustScaler dan MinMaxScaler dari data historis"""
        try:
            # Try load existing scalers
            scaler_data = joblib.load('cri_scalers.joblib')
            self.robust_scaler = scaler_data['robust']
            self.minmax_scaler = scaler_data['minmax']
            print("✓ Loaded existing CRI scalers")
        except:
            # Build new scalers
            print("Building new CRI scalers...")
            
            cols = ["complexity_score", "Urgency_Category", "dependency_count", "likelihood"]
            
            # RobustScaler
            self.robust_scaler = RobustScaler()
            robust_features = self.df_cri[cols].copy()
            self.robust_scaler.fit(robust_features)
            
            # Apply robust scaling
            robust_scaled = self.robust_scaler.transform(robust_features)
            
            # MinMaxScaler
            self.minmax_scaler = MinMaxScaler()
            self.minmax_scaler.fit(robust_scaled)
            
            # Save scalers
            joblib.dump({
                'robust': self.robust_scaler,
                'minmax': self.minmax_scaler
            }, 'cri_scalers.joblib')
            
            print("✓ CRI scalers created and saved")
    
    def _load_historical_stats(self):
        """Load statistik historis untuk estimasi parameter"""
        self.stats = {
            'complexity': {
                'min': self.df_cri['complexity_score'].min(),
                'max': self.df_cri['complexity_score'].max(),
                'mean': self.df_cri['complexity_score'].mean(),
                'median': self.df_cri['complexity_score'].median()
            },
            'dependency': {
                'min': self.df_cri['dependency_count'].min(),
                'max': self.df_cri['dependency_count'].max(),
                'mean': self.df_cri['dependency_count'].mean(),
                'median': self.df_cri['dependency_count'].median()
            },
            'likelihood': self.df_cri['likelihood'].to_dict()
        }
    
    def estimate_complexity(self, ticket_text, urgency='Medium'):
        """
        Estimasi complexity score untuk permintaan baru
        Berdasarkan panjang teks dan keyword-keyword tertentu
        """
        # Base complexity dari panjang teks
        text_length = len(ticket_text.split())
        
        # Keyword multipliers
        complex_keywords = {
            'server': 1.5, 'database': 1.5, 'network': 1.4, 'jaringan': 1.4,
            'instalasi': 1.3, 'maintenance': 1.3, 'backup': 1.2, 'recovery': 1.5,
            'website': 1.3, 'aplikasi': 1.3, 'sistem': 1.2, 'hardware': 1.4,
            'urgent': 1.3, 'critical': 1.5, 'emergency': 1.5
        }
        
        simple_keywords = {
            'password': 0.3, 'reset': 0.3, 'user': 0.4, 'email': 0.5,
            'printer': 0.6, 'akses': 0.5, 'login': 0.4, 'account': 0.5
        }
        
        # Calculate multiplier
        text_lower = ticket_text.lower()
        multiplier = 1.0
        
        for keyword, mult in complex_keywords.items():
            if keyword in text_lower:
                multiplier *= mult
        
        for keyword, mult in simple_keywords.items():
            if keyword in text_lower:
                multiplier *= mult
        
        # Base complexity
        base = self.stats['complexity']['median']
        complexity = base * multiplier * (1 + text_length / 100)
        
        # Clip to historical range
        complexity = np.clip(complexity, 
                            self.stats['complexity']['min'], 
                            self.stats['complexity']['max'])
        
        return complexity
    
    def estimate_dependency(self, ticket_text):
        """Estimasi dependency count berdasarkan kompleksitas permintaan"""
        text_lower = ticket_text.lower()
        
        # Keywords yang mengindikasikan multiple dependencies
        dependency_keywords = {
            'server': 2, 'database': 2, 'network': 2, 'sistem': 1,
            'aplikasi': 1, 'website': 2, 'hardware': 1, 'software': 1,
            'backup': 1, 'recovery': 2, 'maintenance': 1
        }
        
        dep_score = 0
        for keyword, score in dependency_keywords.items():
            if keyword in text_lower:
                dep_score += score
        
        # Default minimum
        if dep_score == 0:
            dep_score = int(self.stats['dependency']['median'])
        
        return dep_score
    
    def estimate_likelihood(self, request_type):
        """
        Estimasi likelihood berdasarkan request type
        Menggunakan distribusi historis
        """
        # Cari request type yang mirip di data historis
        if 'Request Name' in self.df_cri.columns:
            freq = self.df_cri['Request Name'].value_counts()
            likelihood_dist = freq / freq.sum()
            
            # Exact match
            if request_type in likelihood_dist:
                return likelihood_dist[request_type]
            
            # Fuzzy match
            request_lower = request_type.lower()
            for req_name, likelihood in likelihood_dist.items():
                if request_lower in str(req_name).lower() or str(req_name).lower() in request_lower:
                    return likelihood
        
        # Default: median likelihood
        return 0.05  # 5% default probability
    
    def calculate_cri(self, ticket_text, request_type='General Request', urgency='Medium'):
        """
        Hitung CRI untuk permintaan baru
        
        Returns:
            dict dengan semua parameter dan CRI final (normalized)
        """
        print(f"\n{'='*60}")
        print("CALCULATING CRI FOR NEW REQUEST")
        print(f"{'='*60}")
        print(f"Ticket: {ticket_text[:100]}...")
        print(f"Type: {request_type}")
        print(f"Urgency: {urgency}")
        
        # 1. Estimate parameters
        complexity = self.estimate_complexity(ticket_text, urgency)
        dependency = self.estimate_dependency(ticket_text)
        likelihood = self.estimate_likelihood(request_type)
        
        # Urgency mapping
        urgency_map = {'Low': 0.5, 'Medium': 0.75, 'High': 1.0}
        urgency_score = urgency_map.get(urgency, 0.75)
        
        print(f"\nEstimated Parameters:")
        print(f"  - Complexity Score: {complexity:.4f}")
        print(f"  - Urgency Category: {urgency_score:.4f}")
        print(f"  - Dependency Count: {dependency}")
        print(f"  - Likelihood: {likelihood:.6f}")
        
        # 2. Create feature array
        features = np.array([[complexity, urgency_score, dependency, likelihood]])
        
        # 3. Apply RobustScaler
        features_robust = self.robust_scaler.transform(features)
        
        # 4. Calculate Composite Risk Index
        cri_weights = CONFIG['cri_weights']
        cri_robust = (
            cri_weights['complexity'] * features_robust[0, 0] +
            cri_weights['urgency'] * features_robust[0, 1] +
            cri_weights['dependency'] * features_robust[0, 2] +
            cri_weights['likelihood'] * features_robust[0, 3]
        )
        
        # 5. Normalize dengan MinMaxScaler
        cri_normalized = self.minmax_scaler.transform([[cri_robust, 0, 0, 0]])[0, 0]
        
        # Clip to [0, 1]
        cri_normalized = np.clip(cri_normalized, 0, 1)
        
        # Determine risk level
        if cri_normalized < 0.3:
            risk_level = "LOW"
        elif cri_normalized < 0.7:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"
        
        print(f"\n{'─'*60}")
        print(f"CRI Result: {cri_normalized:.4f} ({risk_level})")
        print(f"{'─'*60}")
        
        return {
            'complexity_score': complexity,
            'urgency_category': urgency_score,
            'dependency_count': dependency,
            'likelihood': likelihood,
            'cri_robust': cri_robust,
            'cri_normalized': cri_normalized,
            'risk_level': risk_level
        }

# =============================================================================
# MODULE 2: TSM CALCULATOR (from previous code)
# =============================================================================
class TSMCalculator:
    """Talent Scoring Model untuk matching engineer dengan permintaan"""
    
    def __init__(self, data_olah_path, data_cri_path):
        print("\n" + "="*80)
        print("INITIALIZING TSM CALCULATOR")
        print("="*80)
        
        self.data_olah = data_olah_path
        self.data_cri = data_cri_path
        
        # Load or build models
        self._load_or_build_models()
    
    def _load_or_build_models(self):
        """Load existing models atau build baru"""
        try:
            print("Loading existing TSM models...")
            skill_data = joblib.load('engineer_profiles_tags.joblib')
            centroid_data = joblib.load('engineer_centroids_tfidf.joblib')
            
            self.profiles = skill_data['profiles']
            self.tfidf_obj = skill_data['tfidf_tag']
            self.centroids = centroid_data['centroids']
            print("✓ TSM models loaded successfully")
        except:
            print("Building new TSM models...")
            self.profiles, self.centroids, self.tfidf_obj = self._build_skill_profiles()
            
            # Save models
            joblib.dump({'tfidf_tag': self.tfidf_obj, 'profiles': self.profiles}, 
                        'engineer_profiles_tags.joblib')
            joblib.dump({'tfidf_tag': self.tfidf_obj, 'centroids': self.centroids}, 
                        'engineer_centroids_tfidf.joblib')
            print("✓ TSM models saved")
    
    def _build_skill_profiles(self):
        """Build skill profiles dari data historis"""
        df = pd.read_csv(self.data_olah)
        
        columns = {
            'summary': find_col(df, ['Summary','summary','Summary_x']),
            'judul': find_col(df, ['Judul Request_x','Judul_Request_x','Judul Request x','judul request_x','judul']),
            'description': find_col(df, ['Description','Deskripsi','description','deskripsi']),
            'status_x': find_col(df, ['Status_x','Status x','status_x','status']),
            'status_y': find_col(df, ['Status_y','Status y','status_y']),
            'engineer': find_col(df, ['Engineer','engineer','Assignee','assignee','petugas','pegawai']),
        }
        
        # Gabungkan text fields
        df['text_raw'] = ""
        if columns['summary']:
            df['text_raw'] += df[columns['summary']].fillna("").astype(str) + " "
        if columns['judul']:
            df['text_raw'] += df[columns['judul']].fillna("").astype(str) + " "
        if columns['description']:
            df['text_raw'] += df[columns['description']].fillna("").astype(str) + " "
        
        df['text_processed'] = df['text_raw'].apply(preprocess_text)
        
        # Filter completed tasks
        mask = (df[columns['engineer']].notna()) & (df['text_processed'].str.strip() != '')
        df_skill = df[mask].copy().reset_index(drop=True)
        
        # TF-IDF
        tfidf = TfidfVectorizer(min_df=CONFIG['min_df'], max_df=CONFIG['max_df'])
        X_tfidf = tfidf.fit_transform(df_skill['text_processed'].fillna("").tolist())
        terms = tfidf.get_feature_names_out()
        
        # Extract tags per engineer
        eng_tag_counts = defaultdict(Counter)
        for idx, row in df_skill.iterrows():
            eng = row[columns['engineer']]
            if pd.isna(eng):
                continue
            
            vec = X_tfidf[idx]
            arr = vec.toarray().ravel()
            if arr.sum() == 0:
                continue
            
            top_idx = np.argsort(arr)[-CONFIG['top_n_tags']:][::-1]
            top_tags = [terms[i] for i in top_idx if arr[i] > 0]
            eng_tag_counts[eng].update(top_tags)
        
        # Build profiles
        profiles = {}
        for eng, ctr in eng_tag_counts.items():
            total_tickets = sum(ctr.values())
            max_count = max(ctr.values()) if ctr else 1
            
            tag_scores = {}
            for tag, cnt in ctr.items():
                frequency_score = cnt / max_count
                relative_score = cnt / total_tickets
                combined_score = (frequency_score * CONFIG['frequency_weight']) + \
                               (relative_score * CONFIG['relative_weight'])
                tag_scores[tag] = combined_score
            
            profiles[eng] = tag_scores
        
        # Build centroids
        engineer_centroids = {}
        for eng, idxs in df_skill.groupby(columns['engineer']).indices.items():
            rows_tfidf = X_tfidf[list(idxs)]
            centroid = rows_tfidf.mean(axis=0)
            
            if hasattr(centroid, 'A'):
                centroid = csr_matrix(centroid.A)
            elif isinstance(centroid, np.ndarray):
                if centroid.ndim == 1:
                    centroid = centroid.reshape(1, -1)
                centroid = csr_matrix(centroid)
            
            engineer_centroids[eng] = centroid
        
        print(f"✓ Built skill profiles for {len(profiles)} engineers")
        
        return profiles, engineer_centroids, tfidf
    
    def get_employees_from_api(self):
        """Ambil data employee dari API"""
        url = f"{CONFIG['base_url']}/employees"
        try:
            resp = requests.get(url, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            
            if isinstance(data, dict) and "data" in data:
                records = data["data"]
            else:
                records = data
            
            df = pd.DataFrame(records)
            print(f"✓ API: Loaded {len(df)} employees")
            return df
        except Exception as e:
            print(f"✗ API Error: {e}")
            return pd.DataFrame()
    
    def get_availability(self, df_employees):
        """Check availability dari API"""
        availability = {}
        
        for _, row in df_employees.iterrows():
            engineer_name = row.get('name', '')
            is_available = True
            
            if 'on_leave' in row and row['on_leave']:
                is_available = False
            elif 'is_available' in row and not row['is_available']:
                is_available = False
            elif 'status' in row and str(row['status']).lower() in ['cuti', 'leave', 'inactive']:
                is_available = False
            
            availability[engineer_name] = 1 if is_available else 0
        
        return availability
    
    def calculate_seniority(self, df_employees):
        """Hitung seniority weight"""
        df = df_employees.copy()
        df["years_of_service"] = pd.to_numeric(df["years_of_service"], errors="coerce")
        
        q1 = df["years_of_service"].quantile(0.25)
        q2 = df["years_of_service"].quantile(0.50)
        q3 = df["years_of_service"].quantile(0.75)
        
        def seniority_weight(y):
            if pd.isna(y): return 0.25
            if y <= q1: return 0.25
            elif y <= q2: return 0.50
            elif y <= q3: return 0.75
            else: return 1.0
        
        df["seniority_weight"] = df["years_of_service"].apply(seniority_weight)
        
        return dict(zip(df['name'], df['seniority_weight']))
    
    def calculate_workload(self):
        """Hitung current workload"""
        df_olah = pd.read_csv(self.data_olah)
        df_cri = pd.read_csv(self.data_cri)
        
        # Filter only In Progress
        status_col = find_col(df_olah, ['Status','status','Status_x','status_x'])
        if status_col:
            df_olah[status_col] = df_olah[status_col].astype(str).str.strip().str.lower()
            df_olah = df_olah[df_olah[status_col] == 'in progress']
        
        if df_olah.empty:
            return {}
        
        # Get engineer column
        eng_col = find_col(df_olah, ['Engineer','engineer','Assignee','assignee'])
        if eng_col is None:
            return {}
        
        # Simple count-based workload
        df_result = df_olah.groupby(eng_col).size().reset_index(name='ticket_count')
        df_result.columns = ['Engineer', 'ticket_count']
        
        min_val = df_result['ticket_count'].min()
        max_val = df_result['ticket_count'].max()
        
        if max_val == min_val:
            df_result['workload_final'] = 0.5
        else:
            df_result['workload_normalized'] = (df_result['ticket_count'] - min_val) / (max_val - min_val)
            df_result['workload_final'] = 1 - df_result['workload_normalized']
        
        return dict(zip(df_result['Engineer'], df_result['workload_final']))
    
    def match_ticket(self, ticket_text):
        """Match ticket dengan engineers berdasarkan skill similarity"""
        processed_text = preprocess_text(ticket_text)
        v = self.tfidf_obj.transform([processed_text])
        
        sims = {}
        for eng, cent in self.centroids.items():
            sim = cosine_similarity(v, cent)[0, 0]
            sims[eng] = float(sim)
        
        maxv = max(sims.values()) if sims else 1.0
        if maxv > 0:
            sims = {k: v / maxv for k, v in sims.items()}
        
        return sims
    
    def calculate_tsm(self, ticket_text):
        """
        Calculate TSM scores untuk semua engineers
        
        Returns:
            DataFrame dengan ranking engineers
        """
        print(f"\n{'='*60}")
        print("CALCULATING TSM SCORES")
        print(f"{'='*60}")
        
        # Get data
        df_employees = self.get_employees_from_api()
        if df_employees.empty:
            return pd.DataFrame()
        
        availability = self.get_availability(df_employees)
        seniority = self.calculate_seniority(df_employees)
        workload = self.calculate_workload()
        skill_scores = self.match_ticket(ticket_text)
        
        # Calculate TSM for all engineers
        all_engineers = set()
        all_engineers.update(skill_scores.keys())
        all_engineers.update(availability.keys())
        
        tsm_results = []
        weights = CONFIG['tsm_weights']
        
        for eng in all_engineers:
            # Skip jika tidak available
            if availability.get(eng, 0) == 0:
                continue
            
            skill_sc = skill_scores.get(eng, 0)
            seniority_sc = seniority.get(eng, 0.25)
            workload_sc = workload.get(eng, 0.5)
            
            tsm = (skill_sc * weights['skill'] + 
                   seniority_sc * weights['seniority'] + 
                   workload_sc * weights['workload'])
            
            tsm_results.append({
                'engineer': eng,
                'skill_score': round(skill_sc, 4),
                'seniority_weight': round(seniority_sc, 4),
                'workload_capacity': round(workload_sc, 4),
                'tsm_score': round(tsm, 4)
            })
        
        df_results = pd.DataFrame(tsm_results)
        df_results = df_results.sort_values('tsm_score', ascending=False).reset_index(drop=True)
        
        print(f"✓ TSM calculated for {len(df_results)} available engineers")
        
        return df_results

# =============================================================================
# MODULE 3: INTEGRATED AI ASSIGNMENT SYSTEM
# =============================================================================
class AIAssignmentSystem:
    """
    Integrated system yang menggabungkan CRI dan TSM
    untuk assignment engineer yang optimal
    """
    
    def __init__(self, data_olah_path, data_cri_path):
        print("\n" + "🎯"*40)
        print("INITIALIZING AI ASSIGNMENT SYSTEM")
        print("🎯"*40)
        
        # Initialize CRI Calculator
        self.cri_calculator = CRICalculator(data_cri_path)
        
        # Initialize TSM Calculator
        self.tsm_calculator = TSMCalculator(data_olah_path, data_cri_path)
        
        print("\n✓ AI Assignment System ready!")
    
    def assign_engineer(self, ticket_text, request_type='General Request', urgency='Medium'):
        """
        Main assignment function
        
        Steps:
        1. Calculate CRI untuk permintaan
        2. Get top 5 engineers dari TSM
        3. Select best engineer berdasarkan CRI-TSM matching
        
        Returns:
            dict dengan hasil assignment lengkap
        """
        print("\n" + "🚀"*40)
        print("AI ASSIGNMENT PROCESS STARTED")
        print("🚀"*40)
        print(f"\nInput Request:")
        print(f"  Text: {ticket_text}")
        print(f"  Type: {request_type}")
        print(f"  Urgency: {urgency}")
        
        # ===== STEP 1: Calculate CRI =====
        cri_result = self.cri_calculator.calculate_cri(ticket_text, request_type, urgency)
        
        # ===== STEP 2: Calculate TSM and get top candidates =====
        tsm_results = self.tsm_calculator.calculate_tsm(ticket_text)
        
        if tsm_results.empty:
            print("\n❌ ERROR: No available engineers found")
            return None
        
        # Get top K candidates
        top_k = min(CONFIG['top_k_candidates'], len(tsm_results))
        top_candidates = tsm_results.head(top_k).copy()
        
        print(f"\n{'='*80}")
        print(f"TOP {top_k} ENGINEER CANDIDATES FROM TSM")
        print(f"{'='*80}")
        for idx, row in top_candidates.iterrows():
            print(f"{idx+1}. {row['engineer']:<30} TSM: {row['tsm_score']:.4f}")
        
        # ===== STEP 3: Select best engineer based on CRI-TSM matching =====
        selected_engineer = self._select_best_engineer(cri_result, top_candidates)
        
        # ===== Compile final result =====
        result = {
            'selected_engineer': selected_engineer['engineer'],
            'assignment_score': selected_engineer['final_score'],
            'cri_analysis': {
                'cri_normalized': cri_result['cri_normalized'],
                'risk_level': cri_result['risk_level'],
                'complexity_score': cri_result['complexity_score'],
                'urgency_category': cri_result['urgency_category'],
                'dependency_count': cri_result['dependency_count'],
                'likelihood': cri_result['likelihood']
            },
            'tsm_analysis': {
                'engineer': selected_engineer['engineer'],
                'tsm_score': selected_engineer['tsm_score'],
                'skill_score': selected_engineer['skill_score'],
                'seniority_weight': selected_engineer['seniority_weight'],
                'workload_capacity': selected_engineer['workload_capacity']
            },
            'top_candidates': top_candidates.to_dict('records'),
            'recommendation_reason': selected_engineer['reason']
        }
        
        # Print final result
        self._print_assignment_result(result)
        
        return result
    
    def _select_best_engineer(self, cri_result, top_candidates):
        """
        Pilih engineer terbaik dari top candidates berdasarkan CRI-TSM matching
        
        Logic:
        - High CRI (>0.7): Pilih engineer dengan TSM tertinggi (butuh yang paling capable)
        - Medium CRI (0.3-0.7): Balance antara skill dan workload
        - Low CRI (<0.3): Prioritaskan workload capacity (bisa handle oleh junior)
        """
        print(f"\n{'='*80}")
        print("SELECTING BEST ENGINEER")
        print(f"{'='*80}")
        
        cri_normalized = cri_result['cri_normalized']
        risk_level = cri_result['risk_level']
        
        print(f"CRI: {cri_normalized:.4f} ({risk_level})")
        
        # Add selection score untuk setiap kandidat
        top_candidates = top_candidates.copy()
        
        if risk_level == "HIGH":
            # High risk: prioritas skill dan seniority
            print("Strategy: HIGH RISK - Prioritizing skill and seniority")
            top_candidates['selection_score'] = (
                0.6 * top_candidates['skill_score'] +
                0.3 * top_candidates['seniority_weight'] +
                0.1 * top_candidates['workload_capacity']
            )
            reason = "High complexity task requires most skilled and senior engineer"
            
        elif risk_level == "LOW":
            # Low risk: prioritas workload capacity
            print("Strategy: LOW RISK - Prioritizing workload capacity")
            top_candidates['selection_score'] = (
                0.2 * top_candidates['skill_score'] +
                0.2 * top_candidates['seniority_weight'] +
                0.6 * top_candidates['workload_capacity']
            )
            reason = "Low complexity task can be handled by engineer with more capacity"
            
        else:  # MEDIUM
            # Medium risk: balanced approach
            print("Strategy: MEDIUM RISK - Balanced approach")
            top_candidates['selection_score'] = (
                0.4 * top_candidates['skill_score'] +
                0.3 * top_candidates['seniority_weight'] +
                0.3 * top_candidates['workload_capacity']
            )
            reason = "Medium complexity task requires balanced skill and capacity"
        
        # Sort by selection score
        top_candidates = top_candidates.sort_values('selection_score', ascending=False)
        
        # Select best
        best = top_candidates.iloc[0]
        
        print(f"\n{'─'*80}")
        print(f"SELECTED: {best['engineer']}")
        print(f"Selection Score: {best['selection_score']:.4f}")
        print(f"{'─'*80}")
        
        return {
            'engineer': best['engineer'],
            'tsm_score': best['tsm_score'],
            'skill_score': best['skill_score'],
            'seniority_weight': best['seniority_weight'],
            'workload_capacity': best['workload_capacity'],
            'final_score': best['selection_score'],
            'reason': reason
        }
    
    def _print_assignment_result(self, result):
        """Print hasil assignment dalam format yang mudah dibaca"""
        print("\n" + "🎉"*40)
        print("ASSIGNMENT RESULT")
        print("🎉"*40)
        
        print(f"\n{'='*80}")
        print("✓ SELECTED ENGINEER")
        print(f"{'='*80}")
        print(f"Engineer Name: {result['selected_engineer']}")
        print(f"Assignment Score: {result['assignment_score']:.4f}")
        print(f"Reason: {result['recommendation_reason']}")
        
        print(f"\n{'='*80}")
        print("CRI ANALYSIS")
        print(f"{'='*80}")
        cri = result['cri_analysis']
        print(f"CRI Normalized: {cri['cri_normalized']:.4f}")
        print(f"Risk Level: {cri['risk_level']}")
        print(f"  - Complexity Score: {cri['complexity_score']:.4f}")
        print(f"  - Urgency Category: {cri['urgency_category']:.4f}")
        print(f"  - Dependency Count: {cri['dependency_count']}")
        print(f"  - Likelihood: {cri['likelihood']:.6f}")
        
        print(f"\n{'='*80}")
        print("TSM ANALYSIS")
        print(f"{'='*80}")
        tsm = result['tsm_analysis']
        print(f"Engineer: {tsm['engineer']}")
        print(f"TSM Score: {tsm['tsm_score']:.4f}")
        print(f"  - Skill Match: {tsm['skill_score']:.4f}")
        print(f"  - Seniority: {tsm['seniority_weight']:.4f}")
        print(f"  - Workload Capacity: {tsm['workload_capacity']:.4f}")
        
        print(f"\n{'='*80}")
        print(f"TOP {len(result['top_candidates'])} CANDIDATES")
        print(f"{'='*80}")
        for i, cand in enumerate(result['top_candidates'], 1):
            print(f"{i}. {cand['engineer']:<30} TSM: {cand['tsm_score']:.4f}")
        
        print("\n" + "="*80)

# =============================================================================
# === CHANGES: Replace automated tests with interactive input mode ===
# =============================================================================

def _prompt_input(prompt, default=None):
    try:
        val = input(prompt)
        if val is None or val.strip() == "":
            return default
        return val.strip()
    except EOFError:
        return default

if __name__ == "__main__":
    print("\n" + "🌟"*40)
    print("AI ASSIGNMENT SYSTEM - INTERACTIVE MODE")
    print("🌟"*40)
    
    # Initialize system (this will build/load models and scalers)
    system = AIAssignmentSystem(
        data_olah_path=CONFIG['data_olah'],
        data_cri_path=CONFIG['data_cri']
    )
    
    print("\nMode interaktif: masukkan judul/perincian permintaanmu. Ketik 'exit' untuk keluar.\n")
    while True:
        user_text = _prompt_input("Masukkan deskripsi permintaan (judul/summary): ", default="")
        if not user_text:
            print("Tidak ada input. Ketik 'exit' untuk keluar atau masukkan deskripsi yang valid.")
            continue
        if user_text.lower().strip() == 'exit':
            print("Keluar dari interactive mode. Sampai jumpa!")
            break
        
        user_type = _prompt_input("Masukkan tipe request (contoh: 'Network Support', default: 'General Request'): ", default="General Request")
        if user_type and user_type.lower().strip() == 'exit':
            print("Keluar dari interactive mode. Sampai jumpa!")
            break
        
        user_urgency = _prompt_input("Masukkan urgency [Low/Medium/High] (default: Medium): ", default="Medium")
        if user_urgency and user_urgency.lower().strip() == 'exit':
            print("Keluar dari interactive mode. Sampai jumpa!")
            break
        
        # Normalize urgency input
        u = user_urgency.title() if isinstance(user_urgency, str) else "Medium"
        if u not in ['Low', 'Medium', 'High']:
            print(f"Urgency '{user_urgency}' tidak dikenal. Menggunakan default 'Medium'.")
            u = 'Medium'
        
        # Run assignment
        try:
            res = system.assign_engineer(ticket_text=user_text, request_type=user_type, urgency=u)
            if res is None:
                print("Assignment gagal — periksa koneksi API atau data sumber.")
        except Exception as e:
            print(f"Terjadi error saat proses assignment: {e}")
            print("Lanjutkan mencoba atau ketik 'exit' untuk keluar.")
    
    print("\n✅ Interactive session ended.")
