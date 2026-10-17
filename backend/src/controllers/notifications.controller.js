const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { success, serializeDocument } = require('../utils/serialize');
const { paginatedList } = require('../utils/pagination');
const list = asyncHandler(async (req, res) => {
  const filter = { recipientId: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const result = await paginatedList(Notification, filter, req.query, { sort: { createdAt: -1 } });
  return success(res, result.items.map(serializeDocument), 200, result.meta);
});
const markRead = asyncHandler(async (req, res) => {
  const item = await Notification.findOne({ _id: req.params.id, recipientId: req.user._id });
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
  item.readAt = item.readAt || new Date();
  await item.save();
  return success(res, serializeDocument(item));
});
const readAll = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ recipientId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  return success(res, { modifiedCount: result.modifiedCount });
});
module.exports = { list, markRead, readAll };
