const { z } = require('zod');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');
const pageQuery = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  search: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).optional()
}).passthrough();
module.exports = { objectId, pageQuery };
