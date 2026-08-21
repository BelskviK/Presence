import AuditLog from '../models/AuditLog.js';

// Records one audit row per mutating request.
//
// The response body is captured synchronously (so we can read the created
// entity's id and the success flag), but the database write happens after the
// response has been flushed — auditing must never add latency to, or fail,
// the request it is recording.
export const logAction = (action, targetEntity, getTargetId = null) => (req, res, next) => {
  const originalJson = res.json;
  let body = null;

  res.json = function (data) {
    body = data;
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const succeeded = res.statusCode < 400 && body?.success !== false;

    // Prefer an id the route can point at; fall back to one the handler
    // returned (e.g. a freshly created user).
    let targetId = null;
    try {
      targetId = getTargetId ? getTargetId(req, body) : null;
    } catch {
      targetId = null;
    }

    const actor = req.user;
    AuditLog.create({
      userId: actor?.id || null,
      action,
      targetEntity,
      targetId,
      description: describe(action, actor, body),
      status: succeeded ? 'SUCCESS' : 'FAILURE',
      errorMessage: succeeded ? null : body?.message || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch((err) => console.error('Audit log write failed:', err.message));
  });

  next();
};

const ACTOR = (user) => (user ? `${user.firstName} ${user.lastName}` : 'Unknown user');

const describe = (action, actor, body) => {
  const who = ACTOR(actor);
  switch (action) {
    case 'CLOCK_IN': return `${who} clocked in`;
    case 'CLOCK_OUT': return `${who} clocked out`;
    case 'LEAVE_REQUEST': return `${who} requested leave`;
    case 'LEAVE_APPROVE': return `${who} approved a leave request`;
    case 'LEAVE_REJECT': return `${who} rejected a leave request`;
    case 'ATTENDANCE_EDIT': return `${who} edited an attendance record`;
    case 'USER_CREATE': return `${who} added ${body?.user ? `${body.user.firstName} ${body.user.lastName}` : 'an employee'}`;
    case 'USER_UPDATE': return `${who} updated ${body?.user ? `${body.user.firstName} ${body.user.lastName}` : 'an employee'}`;
    case 'GEOFENCE_CREATE': return `${who} added office location ${body?.geofence?.name || ''}`.trim();
    case 'GEOFENCE_UPDATE': return `${who} updated office location ${body?.geofence?.name || ''}`.trim();
    case 'GEOFENCE_DELETE': return `${who} deleted an office location`;
    case 'LOGIN': return `${who} signed in`;
    default: return `${action} by ${who}`;
  }
};

// Login runs before `authenticate`, so there is no req.user to read — the
// controller calls this directly once it knows who signed in.
export const recordLogin = (user, req) =>
  AuditLog.create({
    userId: user.id,
    action: 'LOGIN',
    targetEntity: 'USER',
    targetId: user.id,
    description: `${ACTOR(user)} signed in`,
    status: 'SUCCESS',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }).catch((err) => console.error('Audit log write failed:', err.message));

export default logAction;
