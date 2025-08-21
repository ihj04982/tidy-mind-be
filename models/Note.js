const mongoose = require('mongoose');

const Category = require('./Category');

// dateMeta: Note.withDate === true 일 때만 유효
const dateMetaSchema = new mongoose.Schema(
  {
    dueDate: { type: Date, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    pinned: { type: Boolean, default: false },
    withDate: { type: Boolean, default: false },
    dateMeta: dateMetaSchema,
  },
  { timestamps: true },
);

// JSON 파싱
noteSchema.methods.toJSON = function () {
  const obj = this._doc;
  delete obj.__v;
  return obj;
};

// dateMeta 검증
noteSchema.pre('validate', async function () {
  if (!this.categoryId) return;

  const category = await Category.findById(this.categoryId).select('type').lean();

  if (!category) {
    throw new Error('Invalid categoryId: category not found');
  }

  const isWtihDateCategory = category.type === 'withDate';
  const isWithDate = this.withDate;
  const hasMeta = !!this.dateMeta;

  // task/reminder인데 withDate가 false 일 때
  if (isWtihDateCategory && !isWithDate) {
    throw new Error('Task/Reminder catregory requires withDate=true');
  }
  // withDate가 true인데 메타데이터가 없을 때
  if (isWithDate && !hasMeta) {
    throw new Error('withDate=true requires dateMeta');
  }
  // withDate가 false인데 메타데이터가 있을 때
  if (!isWithDate && hasMeta) {
    throw new Error('withDate=false cannot include dateMeta');
  }
});

module.exports = mongoose.model('Note', noteSchema);
