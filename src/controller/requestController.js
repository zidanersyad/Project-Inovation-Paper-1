// src/controller/requestController.js
const axios = require('axios');
const emailService = require('../services/emailService');
const employees = require('../data/employees');

// In-memory storage untuk requests
const requests = [];
let requestIdCounter = 1;
let lastRequest = null;

// Config untuk Python AI Service
const AI_SERVICE_URL = 'http://127.0.0.1:5000';

// POST /api/submit-request
exports.submitRequest = async (req, res) => {
  try {
    console.log('[submitRequest] Incoming body:', JSON.stringify(req.body));

    const {
      serviceId,
      serviceTitle,
      requestor,
      nip,
      branch,
      unit,
      urgency,
      description,
      createdAt
    } = req.body;

    // Validasi
    if (!serviceTitle || !requestor || !description) {
      return res.status(400).json({
        status: 'error',
        message: 'serviceTitle, requestor, and description are required'
      });
    }

    if (description.trim().split(/\s+/).length < 3) {
      return res.status(400).json({
        status: 'error',
        message: 'Description must contain at least 3 words'
      });
    }

    // Create new request with initial status
    const newRequest = {
      id: `req_${requestIdCounter++}`,
      serviceId: serviceId || 'general',
      serviceTitle,
      title: serviceTitle,
      requestor,
      name: requestor,
      nip,
      branch,
      unit,
      urgency: urgency || 'medium',
      description,
      status: 'processing',
      assignedTo: null,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    requests.push(newRequest);
    lastRequest = newRequest;

    console.log(`✓ New request created: ${newRequest.id} - ${serviceTitle}`);
    console.log(`🤖 Calling AI service for automatic assignment...`);

    // Call AI service synchronously for immediate assignment
    try {
      const aiResp = await axios.post(
        `${AI_SERVICE_URL}/ai/assign`,
        {
          ticket_text: newRequest.description || newRequest.title,
          request_type: newRequest.serviceTitle || newRequest.title,
          urgency: (newRequest.urgency || 'medium').toLowerCase().replace(/^./, s => s.toUpperCase())
        },
        { 
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' } 
        }
      );

      if (aiResp.data && aiResp.data.success && aiResp.data.data) {
        const result = aiResp.data.data;
        
        newRequest.assignedTo = result.selected_engineer;
        newRequest.status = 'assigned';
        newRequest.updatedAt = new Date().toISOString();
        newRequest.aiAnalysis = {
          assignmentScore: result.assignment_score,
          cri: result.cri_analysis,
          tsm: result.tsm_analysis,
          reason: result.recommendation_reason
        };
        
        if (result.top_candidates) {
          newRequest.candidates = result.top_candidates;
        }

        console.log(`✅ AI assigned ${newRequest.id} → ${newRequest.assignedTo}`);

        setImmediate(async () => {
          try {
            const eng = employees.find(e => 
              e.name === newRequest.assignedTo || 
              String(e.id) === String(newRequest.assignedTo)
            );
            
            if (eng && eng.email) {
              await emailService.sendAssignmentEmail(newRequest, eng, newRequest.aiAnalysis);
              console.log(`📧 Email sent to: ${eng.name} (${eng.email})`);
            }
          } catch (emailErr) {
            console.error('Error sending assignment email:', emailErr.message);
          }
        });

      } else {
        console.warn(`⚠️ AI service returned no valid data for ${newRequest.id}`);
        newRequest.status = 'open';
      }

    } catch (aiError) {
      console.error('❌ AI Assignment Error:', aiError.message);
      newRequest.status = 'open';
      
      if (aiError.code === 'ECONNREFUSED') {
        console.error('⚠️ AI Service not available at', AI_SERVICE_URL);
      }
    }

    res.status(201).json({
      status: 'success',
      message: newRequest.assignedTo 
        ? `Request submitted and assigned to ${newRequest.assignedTo}` 
        : 'Request submitted, awaiting assignment',
      id: newRequest.id,
      data: {
        ...newRequest,
        aiAnalysis: newRequest.aiAnalysis || null
      }
    });

  } catch (error) {
    console.error('Error in submitRequest:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/requests
exports.getAllRequests = (req, res) => {
  try {
    const { status, assignedTo, urgency } = req.query;
    
    let filteredRequests = [...requests];

    if (status) {
      filteredRequests = filteredRequests.filter(r => r.status === status);
    }

    if (assignedTo) {
      filteredRequests = filteredRequests.filter(r => r.assignedTo === assignedTo);
    }

    if (urgency) {
      filteredRequests = filteredRequests.filter(r => r.urgency === urgency);
    }

    res.json({
      status: 'success',
      count: filteredRequests.length,
      requests: filteredRequests
    });

  } catch (error) {
    console.error('Error in getAllRequests:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// GET /api/requests/:id
exports.getRequestById = (req, res) => {
  try {
    const { id } = req.params;
    const request = requests.find(r => r.id === id);

    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    res.json({
      status: 'success',
      data: request
    });

  } catch (error) {
    console.error('Error in getRequestById:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/reassign
exports.reassignRequest = async (req, res) => {
  try {
    const { requestId, engineerId } = req.body;

    if (!requestId || !engineerId) {
      return res.status(400).json({
        status: 'error',
        message: 'requestId and engineerId are required'
      });
    }

    const request = requests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    const oldAssignee = request.assignedTo;
    request.assignedTo = engineerId;
    request.status = 'assigned';
    request.updatedAt = new Date().toISOString();

    console.log(`✓ Request ${requestId} reassigned: ${oldAssignee || 'none'} → ${engineerId}`);

    if (engineerId) {
      try {
        const eng = employees.find(e => String(e.id) === String(engineerId) || e.name === engineerId);
        if (eng) {
          await emailService.sendAssignmentEmail(request, eng, request.aiAnalysis || null);
        }
      } catch (e) {
        console.error('Error sending reassign email:', e.message || e);
      }
    }

    res.json({
      status: 'success',
      message: 'Request reassigned successfully',
      data: {
        requestId,
        oldAssignee,
        newAssignee: engineerId
      }
    });

  } catch (error) {
    console.error('Error in reassignRequest:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/ai/recommend
exports.aiRecommend = async (req, res) => {
  try {
    const { requests: requestsList } = req.body;

    if (!requestsList || !Array.isArray(requestsList)) {
      return res.status(400).json({
        status: 'error',
        message: 'requests array is required'
      });
    }

    const unassignedRequests = requestsList.filter(r => 
      !r.assignedTo || r.status === 'open'
    );

    if (unassignedRequests.length === 0) {
      return res.json({
        status: 'success',
        message: 'No unassigned requests to process',
        assignments: []
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🤖 Requesting AI recommendations for ${unassignedRequests.length} requests...`);
    console.log(`${'='.repeat(60)}`);

    const aiRequestPayload = {
      requests: unassignedRequests.map(r => ({
        id: r.id,
        ticket_text: r.description || r.title || r.serviceTitle,
        request_type: r.serviceTitle || r.title || 'General Request',
        urgency: (r.urgency || 'medium').toLowerCase().replace(/^\w/, c => c.toUpperCase())
      }))
    };

    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/ai/recommend-batch`,
      {
        requests: aiRequestPayload.requests,
        apply: req.body?.apply === true
      },
      {
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!aiResponse.data.success) {
      throw new Error(aiResponse.data.error || 'AI service returned error');
    }

    const assignments = aiResponse.data.assignments || [];

    console.log(`✓ AI processed ${assignments.length} assignments`);

    let emailResults = [];
    if (assignments.length > 0) {
      console.log(`\n📧 Sending assignment emails...`);
      
      const requestsMap = {};
      unassignedRequests.forEach(r => { requestsMap[r.id] = r; });
      
      const engineersMap = {};
      employees.forEach(e => {
        engineersMap[e.name] = e;
        engineersMap[e.id] = e;
      });

      emailResults = await emailService.sendBatchAssignmentEmails(
        assignments,
        requestsMap,
        engineersMap
      );

      const successCount = emailResults.filter(r => r.success).length;
      console.log(`✓ Sent ${successCount}/${emailResults.length} emails`);
    }

    res.json({
      status: 'success',
      message: `AI recommendations generated for ${assignments.length} requests`,
      assignments: assignments,
      totalProcessed: aiResponse.data.total_processed,
      totalRequests: aiResponse.data.total_requests,
      emailsSent: emailResults.length,
      emailResults: emailResults
    });

  } catch (error) {
    console.error('Error in aiRecommend:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        status: 'error',
        message: 'AI Service is not available. Make sure Python service is running on port 5000.',
        error: error.message
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/ai/assign-single
exports.aiAssignSingle = async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({
        status: 'error',
        message: 'requestId is required'
      });
    }

    const request = requests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    console.log(`\n🤖 Requesting AI assignment for: ${requestId}`);

    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/ai/assign`,
      {
        ticket_text: request.description || request.title,
        request_type: request.serviceTitle || request.title,
        urgency: (request.urgency || 'medium').toLowerCase().replace(/^\w/, c => c.toUpperCase())
      },
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!aiResponse.data.success) {
      throw new Error(aiResponse.data.error || 'AI service returned error');
    }

    const result = aiResponse.data.data;
    const selectedEngineer = result.selected_engineer;

    request.assignedTo = selectedEngineer;
    request.status = 'assigned';
    request.updatedAt = new Date().toISOString();
    request.aiAnalysis = {
      assignmentScore: result.assignment_score,
      cri: result.cri_analysis,
      tsm: result.tsm_analysis,
      reason: result.recommendation_reason
    };

    console.log(`✓ AI assigned ${requestId} → ${selectedEngineer}`);

    res.json({
      status: 'success',
      message: 'Request assigned by AI',
      data: {
        requestId,
        assignedTo: selectedEngineer,
        analysis: request.aiAnalysis
      }
    });

  } catch (error) {
    console.error('Error in aiAssignSingle:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        status: 'error',
        message: 'AI Service is not available. Make sure Python service is running on port 5000.'
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/complete-request
exports.completeRequest = (req, res) => {
  try {
    const { requestId, notes } = req.body;

    if (!requestId) {
      return res.status(400).json({
        status: 'error',
        message: 'requestId is required'
      });
    }

    const request = requests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    request.status = 'completed';
    request.completedAt = new Date().toISOString();
    request.completionNotes = notes || '';
    request.updatedAt = new Date().toISOString();

    console.log(`✓ Request ${requestId} marked as completed`);

    res.json({
      status: 'success',
      message: 'Request marked as completed',
      data: {
        requestId,
        status: request.status,
        completedAt: request.completedAt
      }
    });

  } catch (error) {
    console.error('Error in completeRequest:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/delete-request
exports.deleteRequest = (req, res) => {
  try {
    console.log('[deleteRequest] Request body:', JSON.stringify(req.body));
    const { requestId, reason, rejectionNotes } = req.body;

    if (!requestId) {
      return res.status(400).json({
        status: 'error',
        message: 'requestId is required'
      });
    }

    const index = requests.findIndex(r => r.id === requestId);

    if (index === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    const deletedRequest = requests[index];
    deletedRequest.status = 'deleted';
    deletedRequest.deletedAt = new Date().toISOString();
    deletedRequest.deletionReason = reason || 'No reason provided';
    deletedRequest.rejectionNotes = rejectionNotes || '';

    requests.splice(index, 1);
    requests.push(deletedRequest);

    console.log(`✓ Request ${requestId} deleted. Reason: ${reason}`);

    res.json({
      status: 'success',
      message: 'Request deleted successfully',
      data: {
        requestId,
        status: deletedRequest.status,
        reason: deletedRequest.deletionReason,
        deletedAt: deletedRequest.deletedAt
      }
    });

  } catch (error) {
    console.error('Error in deleteRequest:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/manual-assignment
// ⭐ PERBAIKAN: Menggunakan engineerId, bukan engineerName
exports.manualAssignment = async (req, res) => {
  try {
    const { requestId, engineerId, changeNotes } = req.body;

    if (!requestId || !engineerId) {
      return res.status(400).json({
        status: 'error',
        message: 'requestId and engineerId are required'
      });
    }

    const request = requests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    const oldAssignee = request.assignedTo;
    
    // Update request with manual assignment
    request.assignedTo = engineerId;
    request.status = 'assigned';
    request.updatedAt = new Date().toISOString();
    request.assignmentType = 'manual';
    request.assignmentNotes = changeNotes || 'Manually assigned by admin';
    
    // Keep AI analysis if exists, but mark as overridden
    if (request.aiAnalysis) {
      request.aiAnalysis.overridden = true;
      request.aiAnalysis.overriddenBy = 'admin';
      request.aiAnalysis.overriddenAt = new Date().toISOString();
    }

    console.log(`✓ Request ${requestId} manually assigned: ${oldAssignee || 'unassigned'} → ${engineerId}`);

    // Send notification email to newly assigned engineer
    if (engineerId) {
      try {
        const eng = employees.find(e => e.name === engineerId || String(e.id) === String(engineerId));
        if (eng) {
          await emailService.sendAssignmentEmail(request, eng, request.aiAnalysis || null);
          console.log('✅ Manual assignment email sent to:', eng.name);
        } else {
          console.warn('⚠️ Engineer not found for email:', engineerId);
        }
      } catch (e) {
        console.error('Error sending manual assignment email:', e.message || e);
      }
    }

    res.json({
      status: 'success',
      message: 'Request manually assigned successfully',
      data: {
        requestId,
        oldAssignee,
        newAssignee: engineerId,
        assignmentType: 'manual'
      }
    });

  } catch (error) {
    console.error('Error in manualAssignment:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// POST /api/update-servicecatalog
exports.updateServiceCatalog = (req, res) => {
  try {
    const { requestId, serviceTitle, serviceId, description, changeNotes } = req.body;

    if (!requestId) {
      return res.status(400).json({
        status: 'error',
        message: 'requestId is required'
      });
    }

    const request = requests.find(r => r.id === requestId);

    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: 'Request not found'
      });
    }

    // Store old values for audit trail
    const oldValues = {
      serviceTitle: request.serviceTitle || request.title,
      serviceId: request.serviceId,
      description: request.description
    };

    // Update values
    if (serviceTitle) {
      request.serviceTitle = serviceTitle;
      request.title = serviceTitle;
    }
    if (serviceId) {
      request.serviceId = serviceId;
    }
    if (description !== undefined) {
      request.description = description;
    }

    request.updatedAt = new Date().toISOString();

    // Store change history
    if (!request.changeHistory) {
      request.changeHistory = [];
    }

    request.changeHistory.push({
      timestamp: new Date().toISOString(),
      changedBy: 'admin',
      oldValues,
      newValues: {
        serviceTitle: request.serviceTitle,
        serviceId: request.serviceId,
        description: request.description
      },
      notes: changeNotes || 'Service catalog updated from admin dashboard'
    });

    console.log(`✓ Service Catalog Updated for ${requestId}`);
    console.log(`  Service Title: ${oldValues.serviceTitle} → ${request.serviceTitle}`);
    console.log(`  Service ID: ${oldValues.serviceId} → ${request.serviceId}`);

    res.json({
      status: 'success',
      message: 'Service catalog updated successfully',
      data: {
        requestId,
        updated: {
          serviceTitle: request.serviceTitle,
          serviceId: request.serviceId,
          description: request.description
        },
        oldValues,
        changeNotes: changeNotes || 'Service catalog updated from admin dashboard',
        updatedAt: request.updatedAt,
        changeHistory: request.changeHistory
      }
    });

  } catch (error) {
    console.error('Error in updateServiceCatalog:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Debug helper
exports.getLastRequest = (req, res) => {
  if (!lastRequest) {
    return res.status(404).json({ status: 'error', message: 'No requests yet' });
  }
  res.json({ status: 'success', data: lastRequest });
};

// Export all functions
module.exports = {
  submitRequest: exports.submitRequest,
  getAllRequests: exports.getAllRequests,
  getRequestById: exports.getRequestById,
  reassignRequest: exports.reassignRequest,
  aiRecommend: exports.aiRecommend,
  aiAssignSingle: exports.aiAssignSingle,
  completeRequest: exports.completeRequest,
  deleteRequest: exports.deleteRequest,
  manualAssignment: exports.manualAssignment,
  updateServiceCatalog: exports.updateServiceCatalog,
  getLastRequest: exports.getLastRequest
};