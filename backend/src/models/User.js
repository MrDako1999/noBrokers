const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

// KYC documents are stored on Cloudflare R2. We keep both the public URL
// (so admins can preview them in the panel) and the bucket key (so we can
// delete them on rejection without parsing the URL).
const kycDocSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['ic_front', 'ic_back', 'passport', 'utility', 'selfie', 'other'],
      required: true,
    },
    url: { type: String, required: true },
    key: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // What the user identifies as. Doesn't gate anything — every user can
    // browse, watchlist and offer. Owners use it to reveal the "List a
    // property" CTA on the dashboard.
    accountTypes: {
      type: [{ type: String, enum: ['buyer', 'tenant', 'owner', 'landlord'] }],
      default: ['buyer'],
    },
    kyc: {
      status: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified',
      },
      submittedAt: Date,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rejectionReason: String,
      documents: { type: [kycDocSchema], default: [] },
    },
    // Seller enrollment. Everyone starts as a viewer/buyer; flipping
    // `enrolled` to true is a deliberate opt-in that gates listing creation
    // and the seller-side dashboard. Keeping it separate from `accountTypes`
    // (which is self-reported) so we have an auditable authz flag.
    sellerProfile: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      termsAcceptedVersion: { type: String, default: '' },
      termsAcceptedAt: Date,
    },
    // Cross-device UX preferences. Kept server-side so the buyer/seller
    // switcher survives a fresh login on another device.
    preferences: {
      lastMode: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
      timezone: { type: String, default: 'Asia/Kuala_Lumpur' },
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // Best-effort presence timestamp. Bumped from the chat widget's
    // heartbeat. Used to render "last seen 2m ago" when Pusher presence
    // says the counterpart is offline.
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
)

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.resetPasswordToken
  delete obj.resetPasswordExpires
  return obj
}

module.exports = mongoose.model('User', userSchema)
