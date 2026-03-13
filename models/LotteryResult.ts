import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILotteryResult extends Document {
  period: string; // e.g. "2024-12-30"
  firstPrize: string;
  twoDigitSuffix: string;
  threeDigitFront: string[];
  threeDigitSuffix: string[];
  fetchedAt: Date;
  isProcessed: boolean;
}

const LotteryResultSchema = new Schema<ILotteryResult>(
  {
    period: {
      type: String,
      required: true,
      unique: true,
    },
    firstPrize: {
      type: String,
      required: true,
    },
    twoDigitSuffix: {
      type: String,
      required: true,
    },
    threeDigitFront: {
      type: [String],
      default: [],
    },
    threeDigitSuffix: {
      type: [String],
      default: [],
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
    isProcessed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const LotteryResult: Model<ILotteryResult> =
  mongoose.models.LotteryResult ||
  mongoose.model<ILotteryResult>("LotteryResult", LotteryResultSchema);

export default LotteryResult;
