import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const DEFAULT_ALLOWANCE = {
  VACATION: 21,
  SICK: 14,
  PERSONAL: 5,
  MATERNITY: 90,
};

// Types that draw down an annual balance. VACATION/UNPAID/OTHER don't track a balance.
const BALANCE_TRACKED_TYPES = Object.keys(DEFAULT_ALLOWANCE);

const daysBetweenInclusive = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

export const provisionDefaultBalances = async (userId, year = new Date().getFullYear()) => {
  await Promise.all(
    Object.entries(DEFAULT_ALLOWANCE).map(([leaveType, totalAllowance]) =>
      LeaveBalance.upsert({ userId, year, leaveType, totalAllowance, carryover: 0 })
    )
  );
};

// Submit a leave request
export const submitLeaveRequest = asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, reason, attachments } = req.body;
  const userId = req.userId;

  if (!leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({
      success: false,
      message: 'leaveType, startDate, endDate and reason are required',
    });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({
      success: false,
      message: 'endDate cannot be before startDate',
    });
  }

  const daysRequested = daysBetweenInclusive(startDate, endDate);

  if (BALANCE_TRACKED_TYPES.includes(leaveType)) {
    const year = new Date(startDate).getFullYear();
    let balance = await LeaveBalance.findOne(userId, year, leaveType);
    if (!balance) {
      balance = await LeaveBalance.upsert({
        userId,
        year,
        leaveType,
        totalAllowance: DEFAULT_ALLOWANCE[leaveType],
        carryover: 0,
      });
    }
    if (daysRequested > Number(balance.remaining)) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance: ${balance.remaining} day(s) remaining for ${leaveType}`,
      });
    }
  }

  const request = await LeaveRequest.create({
    userId,
    leaveType,
    startDate,
    endDate,
    daysRequested,
    reason,
    attachments,
  });

  const approvers = await User.findByRoles(['MANAGER', 'ADMIN']);
  await Notification.createForUsers(
    approvers.filter((a) => a.id !== userId).map((a) => a.id),
    {
      type: 'LEAVE_NEW_REQUEST',
      title: 'New leave request',
      message: `${req.user.firstName} ${req.user.lastName} requested ${daysRequested} day(s) of ${leaveType.toLowerCase()} leave`,
      relatedEntity: 'LEAVE',
      relatedId: request.id,
    }
  );

  res.status(201).json({
    success: true,
    message: 'Leave request submitted',
    request,
  });
});

// My leave requests
export const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const requests = await LeaveRequest.findByUser(req.userId);
  res.json({ success: true, requests });
});

// All leave requests (Manager/Admin), optional ?status=PENDING
export const getAllLeaveRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const requests = await LeaveRequest.findAll({ status });
  res.json({ success: true, requests });
});

// My leave balances (auto-provisions defaults on first access)
export const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  let balances = await LeaveBalance.findByUserAndYear(req.userId, year);
  if (balances.length === 0) {
    await provisionDefaultBalances(req.userId, year);
    balances = await LeaveBalance.findByUserAndYear(req.userId, year);
  }
  res.json({ success: true, balances });
});

// Approve a leave request (Manager/Admin)
export const approveLeaveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvalNotes } = req.body;

  const request = await LeaveRequest.findById(id);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Leave request not found' });
  }
  if (request.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: 'Only pending requests can be approved' });
  }

  if (BALANCE_TRACKED_TYPES.includes(request.leaveType)) {
    const year = new Date(request.startDate).getFullYear();
    let balance = await LeaveBalance.findOne(request.userId, year, request.leaveType);
    if (!balance) {
      balance = await LeaveBalance.upsert({
        userId: request.userId,
        year,
        leaveType: request.leaveType,
        totalAllowance: DEFAULT_ALLOWANCE[request.leaveType],
        carryover: 0,
      });
    }
    await LeaveBalance.addUsedDays(request.userId, year, request.leaveType, Number(request.daysRequested));
  }

  const updated = await LeaveRequest.setStatus(id, {
    status: 'APPROVED',
    approvedBy: req.userId,
    approvalNotes,
  });

  await Notification.create({
    userId: request.userId,
    type: 'LEAVE_APPROVED',
    title: 'Leave request approved',
    message: `Your ${request.leaveType.toLowerCase()} leave request (${request.daysRequested} day(s)) was approved`,
    relatedEntity: 'LEAVE',
    relatedId: id,
  });

  res.json({ success: true, message: 'Leave request approved', request: updated });
});

// Reject a leave request (Manager/Admin)
export const rejectLeaveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approvalNotes } = req.body;

  const request = await LeaveRequest.findById(id);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Leave request not found' });
  }
  if (request.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: 'Only pending requests can be rejected' });
  }

  const updated = await LeaveRequest.setStatus(id, {
    status: 'REJECTED',
    approvedBy: req.userId,
    approvalNotes,
  });

  await Notification.create({
    userId: request.userId,
    type: 'LEAVE_REJECTED',
    title: 'Leave request rejected',
    message: `Your ${request.leaveType.toLowerCase()} leave request (${request.daysRequested} day(s)) was rejected${approvalNotes ? `: ${approvalNotes}` : ''}`,
    relatedEntity: 'LEAVE',
    relatedId: id,
  });

  res.json({ success: true, message: 'Leave request rejected', request: updated });
});

// Cancel my own pending leave request
export const cancelLeaveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await LeaveRequest.findById(id);
  if (!request || request.userId !== req.userId) {
    return res.status(404).json({ success: false, message: 'Leave request not found' });
  }
  if (request.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: 'Only pending requests can be cancelled' });
  }

  const updated = await LeaveRequest.setStatus(id, { status: 'CANCELLED', approvedBy: null, approvalNotes: null });
  res.json({ success: true, message: 'Leave request cancelled', request: updated });
});
