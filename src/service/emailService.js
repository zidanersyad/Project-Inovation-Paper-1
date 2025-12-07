// src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Email Service untuk mengirim notifikasi assignment
 */

// Konfigurasi SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter
transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ Email transporter error:', error.message);
    console.log('   Check your EMAIL_USER and EMAIL_PASS in .env file');
  } else {
    console.log('✅ Email server is ready to send messages');
    if (process.env.EMAIL_TEST_MODE === 'true') {
      console.log('⚠️  TEST MODE ENABLED: All emails will be sent to', process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER);
    }
  }
});

/**
 * Template Email Assignment - Sesuai Format Screenshot
 */
function generateAssignmentEmail(requestData, engineerData, aiAnalysis) {
  const { 
    id, 
    serviceTitle,
    serviceId,
    requestor, 
    branch,
    unit,
    urgency, 
    description,
    createdAt 
  } = requestData;

  const engineerName = engineerData.name || engineerData.engineerId || 'Engineer';

  // Map service catalog
  const serviceCatalogMap = {
    'svc_data_laporan': { service: 'DEPOSIT', category: 'BDS' },
    'svc_email': { service: 'EMAIL', category: 'Infrastructure' },
    'svc_eod': { service: 'EOD', category: 'Core Banking' },
    'svc_hw_request': { service: 'HARDWARE', category: 'Infrastructure' },
    'svc_hw_cabang': { service: 'INSTALASI', category: 'Branch Support' },
    'svc_hw_pusat': { service: 'INSTALASI', category: 'HO Support' },
    'svc_hw_server': { service: 'SERVER', category: 'Infrastructure' },
    'svc_network_atm': { service: 'NETWORK', category: 'ATM & Channel' },
    'svc_network_outlet': { service: 'NETWORK', category: 'Branch Network' },
    'svc_maintenance_data': { service: 'MAINTENANCE', category: 'Database' },
    'svc_maintenance_app': { service: 'MAINTENANCE', category: 'Application' },
    'svc_open_booth': { service: 'BOOTH', category: 'Branch Operations' },
    'svc_mimix': { service: 'MIMIX', category: 'Replication' },
    'svc_print_rekening': { service: 'PRINTING', category: 'Operations' },
    'svc_ip_server': { service: 'IP SERVER', category: 'Network' },
    'svc_restore_db': { service: 'RESTORE', category: 'Database' },
    'svc_routing': { service: 'ROUTING', category: 'Network' },
    'svc_server_nonvm': { service: 'SERVER', category: 'Infrastructure' },
    'svc_server_vm': { service: 'SERVER VM', category: 'Virtualization' }
  };

  const serviceInfo = serviceCatalogMap[serviceId] || { service: 'DEPOSIT', category: 'BDS' };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { 
      font-family: Arial, sans-serif; 
      color: #333; 
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    .header { 
      background-color: #2563eb;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 18px;
      font-weight: normal;
    }
    .content {
      padding: 30px 20px;
    }
    .greeting {
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .detail-section { 
      margin: 20px 0; 
    }
    .detail-section h3 { 
      background-color: #d9e2f3; 
      padding: 8px 12px; 
      margin: 20px 0 10px 0;
      font-size: 14px;
      font-weight: 600;
      color: #1e40af;
    }
    table { 
      width: 100%;
      border-collapse: collapse; 
      margin: 10px 0; 
    }
    td { 
      padding: 8px 12px; 
      vertical-align: top; 
      border-bottom: 1px solid #e5e7eb;
    }
    .label { 
      font-weight: 600; 
      color: #666; 
      width: 150px; 
    }
    .value { 
      font-weight: normal;
      color: #333;
    }
    .description-box { 
      background-color: #f9fafb; 
      padding: 15px; 
      margin: 10px 0;
      border-left: 4px solid #2563eb;
      border-radius: 4px;
      line-height: 1.6;
    }
    .link { 
      color: #2563eb; 
      text-decoration: none; 
    }
    .link:hover {
      text-decoration: underline;
    }
    .footer { 
      margin-top: 30px; 
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      color: #666; 
      font-size: 12px;
      text-align: center;
    }
    .ai-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 2px solid #93c5fd;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .ai-box h4 {
      color: #1e40af;
      margin: 0 0 10px 0;
      font-size: 14px;
    }
    .ai-metric {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #bfdbfe;
      font-size: 13px;
    }
    .ai-metric:last-child {
      border-bottom: none;
    }
    .ai-metric-label {
      font-weight: 600;
      color: #1e40af;
    }
    .ai-metric-value {
      color: #1e3a8a;
      font-weight: 600;
    }
    .risk-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .risk-low { background: #d1fae5; color: #065f46; }
    .risk-medium { background: #fef3c7; color: #92400e; }
    .risk-high { background: #fee2e2; color: #991b1b; }
    .test-mode-banner {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
      text-align: center;
      color: #92400e;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    ${process.env.EMAIL_TEST_MODE === 'true' ? `
    <div class="test-mode-banner">
      ⚠️ TEST MODE - Original recipient: ${engineerName} (${engineerData.email || 'No email'})
    </div>
    ` : ''}
    
    <div class="header">
      <h1>ITOD-Database Admin - ${serviceTitle} - ${id} Telah diberikan ke Team anda</h1>
    </div>
    
    <div class="content">
      <div class="greeting">
        <p><strong>Kepada Anda, ${engineerName}</strong></p>
      </div>
      
      <div class="detail-section">
        <h3>Detail informasi penugasan :</h3>
        
        <table>
          <tr>
            <td class="label">Task ID #</td>
            <td class="value"><strong>${id}</strong></td>
          </tr>
          <tr>
            <td class="label">Summary:</td>
            <td class="value">${serviceTitle}</td>
          </tr>
          <tr>
            <td class="label">Service:</td>
            <td class="value">${serviceInfo.service}</td>
          </tr>
          <tr>
            <td class="label">Category:</td>
            <td class="value">${serviceInfo.category}</td>
          </tr>
          <tr>
            <td class="label">Assigned To:</td>
            <td class="value">${engineerName}</td>
          </tr>
        </table>
      </div>
      
      <div class="detail-section">
        <h3>Description</h3>
        <div class="description-box">
          <p style="margin: 0;">${description}</p>
          ${requestor ? `<p style="margin: 10px 0 0 0;"><strong>Requestor:</strong> ${requestor}</p>` : ''}
          ${branch ? `<p style="margin: 5px 0 0 0;"><strong>Branch:</strong> ${branch}</p>` : ''}
        </div>
        
        <p style="margin-top: 15px;"><strong>Web SPO:</strong> <a href="http://jsserve.btn.co.id/jaasl/" class="link">http://jsserve.btn.co.id/jaasl/</a></p>
        <p><strong>Hunting Line:</strong> <a href="tel:021-22032939" class="link">021-22032939</a> (PABX), 30000-8080 (VOIP)</p>
      </div>

      ${aiAnalysis ? `
      <div class="ai-box">
        <h4>🤖 AI Assignment Analysis</h4>
        <div class="ai-metric">
          <span class="ai-metric-label">Assignment Score:</span>
          <span class="ai-metric-value">${(aiAnalysis.assignmentScore * 100).toFixed(1)}%</span>
        </div>
        ${aiAnalysis.cri ? `
        <div class="ai-metric">
          <span class="ai-metric-label">Risk Level:</span>
          <span class="risk-badge risk-${aiAnalysis.cri.risk_level.toLowerCase()}">${aiAnalysis.cri.risk_level}</span>
        </div>
        <div class="ai-metric">
          <span class="ai-metric-label">Complexity Index:</span>
          <span class="ai-metric-value">${(aiAnalysis.cri.cri_normalized * 100).toFixed(1)}%</span>
        </div>
        ` : ''}
        ${aiAnalysis.tsm ? `
        <div class="ai-metric">
          <span class="ai-metric-label">Skill Match:</span>
          <span class="ai-metric-value">${(aiAnalysis.tsm.tsm_score * 100).toFixed(1)}%</span>
        </div>
        ` : ''}
        ${aiAnalysis.reason ? `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #bfdbfe;">
          <p style="margin: 0; color: #1e40af; font-size: 12px; line-height: 1.5;">
            <strong>Reason:</strong> ${aiAnalysis.reason}
          </p>
        </div>
        ` : ''}
      </div>
      ` : ''}
      
      <div class="footer">
        <p>Terima kasih atas perhatian Anda.</p>
        <p>Email ini dikirim secara otomatis dari ITOD Services, mohon tidak membalas email ini.</p>
        <p style="margin-top: 10px;">© 2024 ITOD Services. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
${process.env.EMAIL_TEST_MODE === 'true' ? `⚠️ TEST MODE - Original recipient: ${engineerName} (${engineerData.email || 'No email'})\n\n` : ''}
ITOD-Database Admin - ${serviceTitle} - ${id}
Telah diberikan ke Team anda

Kepada Anda, ${engineerName}

Detail informasi penugasan:
================================
Task ID #: ${id}
Summary: ${serviceTitle}
Service: ${serviceInfo.service}
Category: ${serviceInfo.category}
Assigned To: ${engineerName}

Description:
${description}

${requestor ? `Requestor: ${requestor}` : ''}
${branch ? `Branch: ${branch}` : ''}

Web SPO: http://jsserve.btn.co.id/jaasl/
Hunting Line: 021-22032939 (PABX), 30000-8080 (VOIP)

${aiAnalysis ? `
AI Analysis:
============
Assignment Score: ${(aiAnalysis.assignmentScore * 100).toFixed(1)}%
${aiAnalysis.cri ? `Risk Level: ${aiAnalysis.cri.risk_level}` : ''}
${aiAnalysis.cri ? `Complexity: ${(aiAnalysis.cri.cri_normalized * 100).toFixed(1)}%` : ''}
${aiAnalysis.tsm ? `Skill Match: ${(aiAnalysis.tsm.tsm_score * 100).toFixed(1)}%` : ''}
${aiAnalysis.reason ? `Reason: ${aiAnalysis.reason}` : ''}
` : ''}

---
Terima kasih atas perhatian Anda.
Email ini dikirim secara otomatis dari ITOD Services.
  `;

  return { html: htmlContent, text: textContent };
}

/**
 * Kirim email assignment ke engineer
 */
async function sendAssignmentEmail(requestData, engineerData, aiAnalysis = null) {
  try {
    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ Email configuration missing. Set EMAIL_USER and EMAIL_PASS in .env');
      return {
        success: false,
        error: 'Email configuration not set'
      };
    }

    // Determine recipient
    let recipientEmail = engineerData.email;
    let recipientName = engineerData.name || engineerData.engineerId || 'Engineer';
    let originalRecipient = recipientEmail;

    // TEST MODE: Override recipient if enabled
    if (process.env.EMAIL_TEST_MODE === 'true') {
      const testRecipient = process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER;
      console.log(`⚠️  TEST MODE ACTIVE: Redirecting email`);
      console.log(`   Original: ${recipientName} (${originalRecipient || 'No email'})`);
      console.log(`   Sent to: ${testRecipient}`);
      recipientEmail = testRecipient;
    }

    // Skip if no valid recipient
    if (!recipientEmail) {
      console.warn(`⚠️ No email recipient for: ${recipientName}`);
      if (process.env.EMAIL_TEST_MODE !== 'true') {
        return {
          success: false,
          error: 'No valid email recipient'
        };
      }
      // In test mode, fallback to test recipient
      recipientEmail = process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER;
      console.log(`   Using fallback test recipient: ${recipientEmail}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      console.error(`❌ Invalid email format: ${recipientEmail}`);
      return {
        success: false,
        error: 'Invalid email format'
      };
    }

    const { html, text } = generateAssignmentEmail(requestData, engineerData, aiAnalysis);

    const mailOptions = {
      from: {
        name: 'ITOD Services - Database Administrator',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER
      },
      to: recipientEmail,
      replyTo: 'no-reply@btn.co.id',
      subject: `ITOD-Database Admin - ${requestData.serviceTitle} - ${requestData.id} Telah diberikan ke Team anda`,
      text: text,
      html: html,
      priority: requestData.urgency === 'high' ? 'high' : 'normal'
    };

    console.log(`📧 Sending assignment email...`);
    console.log(`   Request: ${requestData.id} - ${requestData.serviceTitle}`);
    console.log(`   Engineer: ${recipientName}`);
    console.log(`   To: ${recipientEmail}`);
    
    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      recipient: recipientEmail,
      originalRecipient: originalRecipient
    };

  } catch (error) {
    console.error('❌ Error sending assignment email:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'EAUTH') {
      console.error('   Authentication failed. Check EMAIL_USER and EMAIL_PASS');
    } else if (error.code === 'ESOCKET') {
      console.error('   Connection failed. Check EMAIL_HOST and EMAIL_PORT');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Kirim email batch untuk multiple assignments
 */
async function sendBatchAssignmentEmails(assignments, requestsMap, engineersMap) {
  const results = [];

  console.log(`\n📧 Starting batch email send (${assignments.length} assignments)...`);

  for (const assignment of assignments) {
    const request = requestsMap[assignment.requestId];
    const engineer = engineersMap[assignment.engineerId];

    if (!request || !engineer) {
      console.warn(`⚠️ Skipping ${assignment.requestId}: Missing request or engineer data`);
      continue;
    }

    const result = await sendAssignmentEmail(
      request,
      engineer,
      {
        assignmentScore: assignment.score,
        cri: assignment.cri ? { 
          cri_normalized: assignment.cri,
          risk_level: assignment.risk_level 
        } : null,
        tsm: assignment.tsm_score ? {
          tsm_score: assignment.tsm_score
        } : null,
        reason: assignment.reason
      }
    );

    results.push({
      requestId: assignment.requestId,
      engineerId: assignment.engineerId,
      email: engineer.email,
      ...result
    });

    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Batch email complete: ${successCount}/${results.length} sent successfully\n`);

  return results;
}

module.exports = {
  sendAssignmentEmail,
  sendBatchAssignmentEmails,
  transporter
};