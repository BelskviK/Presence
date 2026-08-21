import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const resolveTarget = async (req) => {
  const requestedUserId = req.query.userId;
  const userId = req.user.role === 'EMPLOYEE' ? req.userId : requestedUserId || req.userId;
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1; // 1-12

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const user = await User.findById(userId);
  const records = await Attendance.findRecords({ userId, startDate, endDate, limit: 1000 });

  return { user, records, year, month, monthLabel: MONTH_NAMES[month - 1] };
};

const summarize = (records) => ({
  days: records.length,
  totalHours: records.reduce((sum, r) => sum + (Number(r.totalHours) || 0), 0),
  overtimeHours: records.reduce((sum, r) => sum + (Number(r.overtimeHours) || 0), 0),
});

const fmtTime = (value) => (value ? new Date(value).toTimeString().slice(0, 5) : '-');
const fmtDate = (value) => new Date(value).toISOString().slice(0, 10);

export const exportAttendanceExcel = asyncHandler(async (req, res) => {
  const { user, records, year, monthLabel } = await resolveTarget(req);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Attendance');

  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Clock In', key: 'clockIn', width: 12 },
    { header: 'Clock Out', key: 'clockOut', width: 12 },
    { header: 'Total Hours', key: 'totalHours', width: 14 },
    { header: 'Overtime Hours', key: 'overtimeHours', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];

  ws.insertRow(1, [`Attendance Report — ${user.firstName} ${user.lastName} — ${monthLabel} ${year}`]);
  ws.mergeCells(1, 1, 1, 7);
  ws.getRow(1).font = { bold: true, size: 14 };

  const headerRow = ws.getRow(2);
  ws.columns.forEach((col, i) => {
    headerRow.getCell(i + 1).value = col.header;
  });
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  });

  records.forEach((r) => {
    ws.addRow({
      date: fmtDate(r.date),
      clockIn: fmtTime(r.clockInTime),
      clockOut: fmtTime(r.clockOutTime),
      totalHours: Number(r.totalHours) || 0,
      overtimeHours: Number(r.overtimeHours) || 0,
      status: r.status,
      notes: r.notes || '',
    });
  });

  const { days, totalHours, overtimeHours } = summarize(records);
  const totalRow = ws.addRow({
    date: `Total: ${days} day(s)`,
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
  });
  totalRow.font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${user.lastName}-${year}-${monthLabel}.xlsx"`);
  res.send(Buffer.from(buffer));
});

export const exportAttendancePDF = asyncHandler(async (req, res) => {
  const { user, records, year, monthLabel } = await resolveTarget(req);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${user.lastName}-${year}-${monthLabel}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text('Attendance Report', { align: 'left' });
  doc.fontSize(11).font('Helvetica').fillColor('#555555')
    .text(`${user.firstName} ${user.lastName} — ${user.department}`)
    .text(`${monthLabel} ${year}`);
  doc.moveDown(1);

  const cols = [
    { label: 'Date', width: 80 },
    { label: 'Clock In', width: 70 },
    { label: 'Clock Out', width: 70 },
    { label: 'Hours', width: 60 },
    { label: 'OT', width: 50 },
    { label: 'Status', width: 100 },
  ];
  const startX = doc.page.margins.left;
  let y = doc.y;

  const drawRow = (values, opts = {}) => {
    let x = startX;
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(opts.color || '#000000');
    cols.forEach((col, i) => {
      doc.text(String(values[i]), x, y, { width: col.width, ellipsis: true });
      x += col.width;
    });
    y += 18;
  };

  doc.fillColor('#FFFFFF');
  doc.rect(startX, y - 2, cols.reduce((s, c) => s + c.width, 0), 16).fill('#3B82F6');
  drawRow(cols.map((c) => c.label), { bold: true, color: '#FFFFFF' });

  records.forEach((r) => {
    if (y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    drawRow([
      fmtDate(r.date),
      fmtTime(r.clockInTime),
      fmtTime(r.clockOutTime),
      (Number(r.totalHours) || 0).toFixed(2),
      (Number(r.overtimeHours) || 0).toFixed(2),
      r.status,
    ]);
  });

  const { days, totalHours, overtimeHours } = summarize(records);
  y += 10;
  doc.moveTo(startX, y).lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y).strokeColor('#dddddd').stroke();
  y += 10;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
    .text(`Total days: ${days}   Total hours: ${totalHours.toFixed(2)}   Overtime: ${overtimeHours.toFixed(2)}`, startX, y);

  doc.end();
});
