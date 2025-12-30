export type StackSource = 'HEURISTIC' | 'OPENAI';

export type RecommendedStack = {
  frontend?: string[];
  backend?: string[];
  smartContracts?: string[];
  database?: string[];
  infra?: string[];
  testing?: string[];
  devops?: string[];
  notes?: string[];
};

export type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'HIGH' | string;
export type TaskCategory = 'ARCHITECTURE' | 'MODEL' | 'SERVICE' | 'VIEW' | 'INFRA' | 'QA' | string;
export type ColumnId = 'todo' | 'doing' | 'done' | 'review' | string;

export type Task = {
  id?: string;
  title: string;
  description: string;
  category?: TaskCategory;
  complexity?: TaskComplexity;
  priority?: number;
  estimatedHours?: number;
  hourlyRate?: number;
  taskPrice?: number;
  price?: number;
  developerNetPrice?: number;
  // board helpers
  layer?: TaskCategory;
  columnId?: ColumnId;
  assigneeEmail?: string | null;
  assigneeAvatar?: string | null;
};

export type ProjectEstimation = {
  id?: string;
  projectTitle: string;
  projectDescription: string;
  ownerEmail: string;
  tasks: Task[];
  totalHours: number;
  totalTasksPrice: number;
  platformFeePercent: number;
  platformFeeAmount?: number;
  generatorServiceFee?: number;
  generatorFee?: number;
  grandTotalClientCost: number;
  published?: boolean;
  recommendedStack?: RecommendedStack;
  stackSource?: StackSource;
  stackConfidence?: number;
};

export type Project = {
  id?: string;
  title: string;
  description: string;
  ownerEmail: string;
  estimation?: ProjectEstimation | null;
  tasks?: Task[];
  recommendedStack?: RecommendedStack;
  stackSource?: StackSource;
  stackConfidence?: number;
};
