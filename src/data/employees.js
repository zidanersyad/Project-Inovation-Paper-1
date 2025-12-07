// src/data/employees.js
// WARNING: file-based (in-memory). Changes at runtime won't persist between server restarts.

const names = [
"Sandy Supriyono","Mirpan Munandar","Rhevo Ajjunda Rakhman","Fitra Nopri Setiawan","Jufri Pramono","Reza Harun","Fahmi Siddiq","Lalu Alfitra Kallatida Muhamad","Safri Endri",
"Kosmega","Risky Aswi Narni","Adilah Ahsanah","Yugo Artonanda","Cheptian Simamora","Budy Kersana","Achmad Mahara Fauzy",
"Rony Billberry W","Hendra Yunianto Ardhi","Aby Irawan","Luthfi Ardyansah","Fakhri Hadi","Maulana Safrizal","Andhi Yudha Triawan","Dhimas Bagus Wicaksono","Arif Febrian","Fikry Subarkah","Yohanes Eddo Octavian","Fahrul","Hendarto","Wahyuda Makhuta","Nikmat Marulitua Manurung","Teddy Setiyadi","Ahmad Arif Yuliardi","Prasetyo Adhi Putranto","Muh Fawaz Najib Risal","Hirianinda Malsegianty Sambolangi","Ulfa Herdyani","Wiandini Fauziah","Firman Nuvriandana Rozi","Ardi Mohammad Iqbal","Adian Tampubolon","Dwi Puspitasari","Ade Ilham Mustofa","Yenti Oei","Syamsul Rizal Genisa","Yohanes Simare Mare","Adithia Jovandy","Sarah Shafira","Murdi Santoso","I Putu Cherry Fantastika","Nadia Safa Fajriani","Achmad Koesnadi Alamsyah","Annisa Miftahurrahmi",
"Budi Muchdarli","Qamal Abdul Gaffar","Dwi Kartika Agustina","Poltak G Hutajulu","Putri Nur Prasetia","Yustina Aldiast Ithrisa","Juniar Intan Rahmania","Faisal Hamzah Rangkuti","Dani Kurniawan","Syaiful Wardhana","Nasya Aghita Riona",
"Brilyan Ramadhan Habib Pricanta","Yolanda Natasya Naibaho","Aldy Kurniawan Syafawi","Anggito Anju Hartawan Manalu","Avisenna Abimanyu",
"Wahyu Dwinanto","Kevin Vasco Aruji","Muhammad Ivan Hanif Vidiansyah"
];

const units = [
"Ho Network Specialist","Ho Network Specialist","Branches Network Specialist","Branches Network Specialist","Echannels Network Specialist","Echannels Network Specialist","Echannels Network Specialist","Ho Network Specialist","Branches Network Specialist",
"Ho Infrastructure Specialist","Ho Infrastructure Specialist","Ho Infrastructure Specialist","Backup Management Specialist","Cloud Coe Specialist","Cloud Coe Specialist","Change & Release Management Infrastructure Specialist",
"Data Center Operation Staff Jakarta","Data Center Operation Staff Jakarta","Data Center Supervisor Jakarta","Data Center Operation Staff Jakarta","Data Center Operation Staff Jakarta","Data Center Operation Staff Jakarta","Data Center Operation Staff Jakarta","Data Center Operation Staff Jakarta","Data Center Operation Staff Jakarta","It Resilience & Contuinity Specialist","It Resilience & Contuinity Specialist","It Resilience & Contuinity Specialist","Infrastructure Monitoring Specialist","Infrastructure Monitoring Specialist","Application Monitoring Specialist","Network Monitoring Specialist","Supervisor It Resilience & Contuinity Specialist","Application Support & Change Management","Credit Banking Support Specialist","Credit Banking Support Specialist","Credit Banking Support Specialist","Core Banking System Support Specialist","Core Banking System Support Specialist","Enterprise System Support Specialist","Enterprise System Support Specialist","Treasury & Wholesale Banking Support Specialist","Treasury & Wholesale Banking Support Specialist","Core Banking System Support Specialist","Database Admin Specialist","Database Admin Specialist","Database Admin Specialist","Database Admin Specialist","Change & Release Management Application Specialist","Change & Release Management Application Specialist","Change & Release Management Application Specialist","Change & Release Management Application Specialist","Change & Release Management Application Specialist",
"Problem Management Specialist","Incident Management Specialist","Incident Management Specialist","Incident Management Specialist","Incident Management Specialist","Incident Management Specialist","Incident Management Specialist","Request Management Specialist","Helpdesk Officer","It Knowledge Management Specialist","Incident Management Specialist",
"Front End & Mobile App Specialist","Integration & Microservices Specialist","Digital Back End Specialist","Front End & Mobile App Specialist","Digital Back End Specialist",
"Branch End Point Specialist","Ho End Point Specialist","Software End Point Specialist"
];

// random attendance
function randStatus() {
  return Math.random() < 0.5 ? 'cuti' : 'bekerja';
}

// random masa kerja 1–10 tahun
function randYears() {
  return Math.floor(Math.random() * 10) + 1;
}

/**
 * Generate email address from name
 * Improved version with better handling
 */
function generateEmail(name) {
  if (!name) return '';
  
  // Get domain from environment variable, default to btn.co.id
  const domain = process.env.EMPLOYEE_EMAIL_DOMAIN || 'btn.co.id';
  
  // Normalize name: remove diacritics, convert to lowercase
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim();
  
  // Extract only letters and spaces, then replace spaces with dots
  const localPart = normalized
    .replace(/[^a-z\s]/g, '') // Keep only letters and spaces
    .replace(/\s+/g, '.') // Replace spaces with dots
    .replace(/\.+/g, '.') // Remove consecutive dots
    .replace(/^\.|\.$/g, ''); // Remove leading/trailing dots
  
  if (!localPart) {
    // Fallback if name has no valid characters
    return `employee.${Date.now()}@${domain}`;
  }
  
  return `${localPart}@${domain}`;
}

// Generate employees with proper email addresses
const employees = names.map((n, idx) => ({
  id: idx + 1,
  name: n,
  unit: units[idx] || 'Unknown',
  email: generateEmail(n),
  attendance: randStatus(),
  years_of_service: randYears()
}));

// Log generated emails for verification (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('\n📧 Generated Employee Emails (sample):');
  employees.slice(0, 5).forEach(e => {
    console.log(`   ${e.name} → ${e.email}`);
  });
  console.log(`   ... and ${employees.length - 5} more employees\n`);
}

module.exports = employees;