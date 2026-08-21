const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export const rowToCamel = (row) => {
  if (!row) return null;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[toCamel(key)] = value;
  }
  return result;
};

export const rowsToCamel = (rows) => rows.map(rowToCamel);
