import { title } from "process";

// src/config/betQueryConfig.ts
export const ALLOWED_FILTERS = {
  status: "string",
  creator: "address",
  outcome: "string",

  yesStake: "number",
  noStake: "number",

  yesVotes: "number",
  noVotes: "number",
  invalidVotes: "number",

  createdAt: "date",
  bettingDeadline: "number",
  votingDeadline: "number",
  category: "number",
  proofType: "number",
  title: "string"
};

export const ALLOWED_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "yesStake",
  "noStake",
  "yesVotes",
  "noVotes",
  "invalidVotes",
];
