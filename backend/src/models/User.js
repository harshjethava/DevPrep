const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 50,
      unique: true,
      sparse: true,
      index: true,
      set: (v) => (v === '' ? undefined : v)
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
    },
    googleId: {
      type: String,
      default: '',
      index: true
    },
    password: {
      type: String,
      default: '',
      select: false
    },
    resetPasswordToken: {
      type: String,
      default: ''
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      default: ''
    },
    emailVerificationExpires: {
      type: Date,
      default: null
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    skills: {
      type: [String],
      default: []
    },
    targetRole: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    experienceLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      default: 'Beginner'
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    avatar: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  if (!this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
