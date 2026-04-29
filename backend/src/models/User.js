const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { BET_TYPES } = require('../constants/betting');

const agentDefaultRatesSchema = BET_TYPES.reduce((schema, betType) => {
  schema[betType] = {
    type: Number,
    min: 0,
    default: undefined
  };
  return schema;
}, {});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 4
  },
  role: {
    type: String,
    enum: ['admin', 'agent', 'customer'],
    required: true
  },
  displayRole: {
    type: String,
    trim: true,
    default: ''
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  parentUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stockPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  creditBalance: {
    type: Number,
    default: 0
  },
  ownerPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  keepPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  commissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  defaultRateProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RateProfile',
    default: null
  },
  useCustomRateDefaults: {
    type: Boolean,
    default: false
  },
  defaultRates: {
    type: agentDefaultRatesSchema,
    default: {}
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.displayRole) {
    this.displayRole = this.role === 'customer' ? 'member' : this.role;
  }

  if (!this.parentUserId && this.agentId) {
    this.parentUserId = this.agentId;
  }

  this.status = this.isActive ? (this.status === 'suspended' ? 'suspended' : 'active') : 'inactive';

  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ agentId: 1, role: 1, isActive: 1, status: 1, lastActiveAt: -1 });
userSchema.index({ agentId: 1, role: 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
