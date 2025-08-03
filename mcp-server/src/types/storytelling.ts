export interface StoryTheme {
  name: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MediaFile {
  filename: string;
  filepath: string;
  size: number;
  mimeType: string;
  duration?: number;
}

export interface StoryAnalysisRequest {
  files: MediaFile[];
  themes: StoryTheme[];
  outputOptions: {
    createSpreadsheet: boolean;
    createSummary: boolean;
    createVideoClips: boolean;
    language?: string;
  };
}

export interface Soundbite {
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  emotionalImpact: number;
  pCategory: 'people' | 'places' | 'purpose' | 'plot';
  theme: string;
}

export interface StoryAnalysis {
  people: Array<{
    name: string;
    role: string;
    significance: string;
  }>;
  places: Array<{
    location: string;
    context: string;
    importance: string;
  }>;
  purpose: Array<{
    motivation: string;
    goal: string;
    transformation: string;
  }>;
  plot: Array<{
    event: string;
    timestamp: number;
    significance: string;
  }>;
  soundbites: Soundbite[];
  overallNarrative: string;
}

export interface StoryDeliverables {
  spreadsheetUrl?: string;
  summaryDocUrl?: string;
  videoClipsUrls?: string[];
  finalSequenceUrl?: string;
}

export interface ProcessingStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  results?: {
    analysis: StoryAnalysis;
    deliverables: StoryDeliverables;
  };
  error?: string;
}