const mongoose = require('mongoose');

const resumeItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    startDate: {
      type: String,
      trim: true,
      default: ''
    },
    endDate: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const extractedDataSchema = new mongoose.Schema(
  {
    skills: {
      type: [String],
      default: []
    },
    projects: {
      type: [resumeItemSchema],
      default: []
    },
    experience: {
      type: [resumeItemSchema],
      default: []
    },
    education: {
      type: [resumeItemSchema],
      default: []
    },
    awards: {
      type: [resumeItemSchema],
      default: []
    },
    certifications: {
      type: [resumeItemSchema],
      default: []
    },
    competitiveProgramming: {
      type: [resumeItemSchema],
      default: []
    }
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    rawText: {
      type: String,
      default: ''
    },
    extractedData: {
      type: extractedDataSchema,
      default: () => ({})
    },
    extractionStatus: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending'
    },
    uploadDate: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

resumeSchema.index({ userId: 1, uploadDate: -1 });

const Resume = mongoose.models.Resume || mongoose.model('Resume', resumeSchema);

module.exports = Resume;
