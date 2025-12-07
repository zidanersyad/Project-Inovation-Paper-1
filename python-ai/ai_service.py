"""
AI Service API - Flask Server
Menyediakan endpoint untuk AI Assignment System
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Import AI Assignment System dari file yang sudah ada
# Pastikan file integrated_assignment.py ada di folder yang sama
from integrated_assignment import AIAssignmentSystem, CONFIG

app = Flask(__name__)
CORS(app)  # Enable CORS untuk komunikasi dengan Node.js

# Initialize AI System sekali saat startup
print("Initializing AI Assignment System...")
ai_system = AIAssignmentSystem(
    data_olah_path=CONFIG['data_olah'],
    data_cri_path=CONFIG['data_cri']
)
print("✓ AI System ready!")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'AI Assignment System',
        'version': '1.0'
    })

@app.route('/ai/assign', methods=['POST'])
def assign_engineer():
    """
    Endpoint untuk assign engineer berdasarkan request
    
    Request body:
    {
        "ticket_text": "Instalasi server database",
        "request_type": "Server & Database Request",
        "urgency": "High"
    }
    
    Response:
    {
        "success": true,
        "data": {
            "selected_engineer": "Engineer Name",
            "assignment_score": 0.85,
            "cri_analysis": {...},
            "tsm_analysis": {...},
            "recommendation_reason": "..."
        }
    }
    """
    try:
        data = request.get_json()
        
        # Validasi input
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        ticket_text = data.get('ticket_text', '')
        request_type = data.get('request_type', 'General Request')
        urgency = data.get('urgency', 'Medium')
        
        if not ticket_text or len(ticket_text.strip()) < 3:
            return jsonify({
                'success': False,
                'error': 'ticket_text must be at least 3 characters'
            }), 400
        
        # Normalize urgency
        urgency = urgency.lower().capitalize()
        if urgency not in ['Low', 'Medium', 'High']:
            urgency = 'Medium'
        
        print(f"\n{'='*60}")
        print(f"API Request Received:")
        print(f"  Ticket: {ticket_text[:80]}...")
        print(f"  Type: {request_type}")
        print(f"  Urgency: {urgency}")
        print(f"{'='*60}")
        
        # Call AI Assignment System
        result = ai_system.assign_engineer(
            ticket_text=ticket_text,
            request_type=request_type,
            urgency=urgency
        )
        
        if result is None:
            return jsonify({
                'success': False,
                'error': 'No available engineers found or API connection failed'
            }), 500
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        print(f"ERROR in /ai/assign: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/ai/recommend-batch', methods=['POST'])
def recommend_batch():
    """
    Endpoint untuk batch recommendation
    
    Request body:
    {
        "requests": [
            {
                "id": "req_1",
                "ticket_text": "...",
                "request_type": "...",
                "urgency": "..."
            },
            ...
        ]
    }
    
    Response:
    {
        "success": true,
        "assignments": [
            {
                "requestId": "req_1",
                "engineerId": "Engineer Name",
                "score": 0.85,
                "reason": "..."
            },
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'requests' not in data:
            return jsonify({
                'success': False,
                'error': 'requests array is required'
            }), 400
        
        requests_list = data['requests']
        
        if not isinstance(requests_list, list) or len(requests_list) == 0:
            return jsonify({
                'success': False,
                'error': 'requests must be a non-empty array'
            }), 400
        
        print(f"\n{'='*60}")
        print(f"Batch Recommendation Request: {len(requests_list)} requests")
        print(f"{'='*60}")
        
        assignments = []
        
        for req in requests_list:
            req_id = req.get('id', '')
            ticket_text = req.get('ticket_text') or req.get('description', '')
            request_type = req.get('request_type') or req.get('serviceTitle', 'General Request')
            urgency = req.get('urgency', 'Medium')
            
            if not ticket_text or len(ticket_text.strip()) < 3:
                print(f"  ⚠️ Skipping request {req_id}: invalid ticket_text")
                continue
            
            # Normalize urgency
            urgency = urgency.lower().capitalize()
            if urgency not in ['Low', 'Medium', 'High']:
                urgency = 'Medium'
            
            try:
                result = ai_system.assign_engineer(
                    ticket_text=ticket_text,
                    request_type=request_type,
                    urgency=urgency
                )
                
                if result:
                    assignments.append({
                        'requestId': req_id,
                        'engineerId': result['selected_engineer'],
                        'score': result['assignment_score'],
                        'cri': result['cri_analysis']['cri_normalized'],
                        'risk_level': result['cri_analysis']['risk_level'],
                        'tsm_score': result['tsm_analysis']['tsm_score'],
                        'reason': result['recommendation_reason']
                    })
                    print(f"  ✓ {req_id} → {result['selected_engineer']}")
                else:
                    print(f"  ✗ {req_id}: No result")
                    
            except Exception as e:
                print(f"  ✗ {req_id}: Error - {str(e)}")
                continue
        
        print(f"\n✓ Completed: {len(assignments)}/{len(requests_list)} assignments")
        
        return jsonify({
            'success': True,
            'assignments': assignments,
            'total_processed': len(assignments),
            'total_requests': len(requests_list)
        })
        
    except Exception as e:
        print(f"ERROR in /ai/recommend-batch: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/ai/cri-only', methods=['POST'])
def calculate_cri_only():
    """
    Endpoint untuk hitung CRI saja tanpa assignment
    
    Request body:
    {
        "ticket_text": "...",
        "request_type": "...",
        "urgency": "Medium"
    }
    """
    try:
        data = request.get_json()
        
        ticket_text = data.get('ticket_text', '')
        request_type = data.get('request_type', 'General Request')
        urgency = data.get('urgency', 'Medium')
        
        if not ticket_text:
            return jsonify({
                'success': False,
                'error': 'ticket_text is required'
            }), 400
        
        # Normalize urgency
        urgency = urgency.lower().capitalize()
        if urgency not in ['Low', 'Medium', 'High']:
            urgency = 'Medium'
        
        cri_result = ai_system.cri_calculator.calculate_cri(
            ticket_text=ticket_text,
            request_type=request_type,
            urgency=urgency
        )
        
        return jsonify({
            'success': True,
            'data': cri_result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Check if data files exist
    if not os.path.exists(CONFIG['data_olah']):
        print(f"⚠️ WARNING: {CONFIG['data_olah']} not found!")
    if not os.path.exists(CONFIG['data_cri']):
        print(f"⚠️ WARNING: {CONFIG['data_cri']} not found!")
    
    # Run Flask server
    print("\n" + "="*60)
    print("🚀 Starting AI Service API on http://localhost:5000")
    print("="*60)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )