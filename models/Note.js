const mongoose = require('mongoose');

const CATEGORIES = {
  TASK: {
    name: 'Task',
    color: '#3378FF',
  },
  IDEA: {
    name: 'Idea',
    color: '#63B6FF',
  },
  REMINDER: {
    name: 'Reminder',
    color: '#FD7642',
  },
  WORK: {
    name: 'Work',
    color: '#00B380',
  },
  GOAL: {
    name: 'Goal',
    color: '#7448F7',
  },
  PERSONAL: {
    name: 'Personal',
    color: '#FF8BB7',
  },
  OTHER: {
    name: 'Other',
    color: '#F5C3BD',
  },
};

const completionSchema = new mongoose.Schema(
  {
    dueDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
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
    images: [{ type: String }],
    category: {
      name: {
        type: String,
        enum: Object.values(CATEGORIES).map((cat) => cat.name),
        required: true,
      },
      color: { type: String, required: true },
    },
    completion: completionSchema,
  },
  { timestamps: true },
);

noteSchema.methods.getCategoryColor = function () {
  return CATEGORIES[this.category?.name?.toUpperCase()]?.color;
};

noteSchema.methods.toJSON = function () {
  const obj = this._doc;
  delete obj.__v;
  return obj;
};

noteSchema.pre('validate', function () {
  const withDateCategories = ['Task', 'Reminder'];
  const isWithDateCategory = withDateCategories.includes(this.category?.name);
  const hasCompletion = !!this.completion;

  if (isWithDateCategory && !hasCompletion) {
    throw new Error(`${this.category.name} category requires completion data`);
  }
  if (hasCompletion && !this.completion.dueDate) {
    throw new Error('Completion requires dueDate');
  }
});

noteSchema.pre('save', function () {
  if (this.category?.name && !this.category.color) {
    const categoryData = CATEGORIES[this.category.name.toUpperCase()];
    if (categoryData) {
      this.category.color = categoryData.color;
    }
  }

  if (!this.completion) return;

  if (this.isModified('completion.isCompleted')) {
    if (this.completion.isCompleted) {
      this.completion.completedAt = this.completion.completedAt ?? new Date();
    } else {
      this.completion.completedAt = undefined;
    }
  }
});

module.exports = mongoose.model('Note', noteSchema);
