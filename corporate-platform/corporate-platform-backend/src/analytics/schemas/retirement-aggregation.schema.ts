import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class RetirementAggregation {
  @Prop({ required: true, unique: true })
  key: string; // e.g. '2026-05-29:entity:assetType:project'

  @Prop({ required: true })
  totalRetired: number;

  @Prop({ required: true })
  period: string; // e.g. '2026-05-29', '2026-Q2', etc.

  @Prop({ required: true })
  entity: string;

  @Prop({ required: true })
  assetType: string;

  @Prop({ required: true })
  project: string;
}

export type RetirementAggregationDocument = RetirementAggregation & Document;
export const RetirementAggregationSchema = SchemaFactory.createForClass(
  RetirementAggregation,
);
