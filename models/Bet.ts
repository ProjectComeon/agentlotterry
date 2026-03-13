import mongoose, { Schema, Document, Model } from "mongoose";

export type BetType = "2_top" | "2_bottom" | "3_top" | "3_tote" | "run_top" | "run_bottom";
export type BetStatus = "pending" | "won" | "lost";

export interface IBet extends Document {
  customerId: mongoose.Types.ObjectId;
  dealerId: mongoose.Types.ObjectId;
  period: string; // e.g. "2024-12-30"
  number: string;
  betType: BetType;
  amount: number;
  payoutRate: number;
  payout: number; // calculated on win
  status: BetStatus;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BetSchema = new Schema<IBet>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dealerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    period: {
      type: String,
      required: true,
    },
    number: {
      type: String,
      required: true,
      trim: true,
    },
    betType: {
      type: String,
      enum: ["2_top", "2_bottom", "3_top", "3_tote", "run_top", "run_bottom"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    payoutRate: {
      type: Number,
      required: true,
    },
    payout: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "won", "lost"],
      default: "pending",
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Prevent updates to locked bets
BetSchema.pre("save", function (next) {
  if (this.isModified() && this.isLocked && !this.isNew) {
    return next(new Error("ไม่สามารถแก้ไขข้อมูลที่ถูกล็อกแล้วได้"));
  }
  next();
});

const Bet: Model<IBet> =
  mongoose.models.Bet || mongoose.model<IBet>("Bet", BetSchema);

export default Bet;
