import api from './api';

const download = async (path, params, filename) => {
  const response = await api.get(path, { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const reportService = {
  downloadExcel: (year, month, userId, label = 'report') =>
    download('/reports/attendance/excel', { year, month, userId }, `attendance-${label}-${year}-${month}.xlsx`),

  downloadPDF: (year, month, userId, label = 'report') =>
    download('/reports/attendance/pdf', { year, month, userId }, `attendance-${label}-${year}-${month}.pdf`),
};

export default reportService;
