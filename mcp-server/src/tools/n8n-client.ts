import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { StoryAnalysisRequest, ProcessingStatus } from '../types/storytelling';

export class N8NClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async uploadFiles(files: Express.Multer.File[]): Promise<string[]> {
    const uploadedPaths: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file.buffer, file.originalname);

      try {
        const response = await axios.post(`${this.baseUrl}/webhook/upload-file`, formData, {
          headers: {
            ...formData.getHeaders(),
            'X-N8N-API-KEY': this.apiKey
          }
        });

        uploadedPaths.push(response.data.filepath);
      } catch (error) {
        throw new Error(`Failed to upload file ${file.originalname}: ${error}`);
      }
    }

    return uploadedPaths;
  }

  async startStorytellingWorkflow(request: StoryAnalysisRequest): Promise<string> {
    try {
      const response = await this.client.post('/webhook/storytelling-analysis', {
        files: request.files,
        themes: request.themes,
        outputOptions: request.outputOptions
      });

      return response.data.executionId;
    } catch (error) {
      throw new Error(`Failed to start storytelling workflow: ${error}`);
    }
  }

  async getExecutionStatus(executionId: string): Promise<ProcessingStatus> {
    try {
      const response = await this.client.get(`/api/v1/executions/${executionId}`);
      const execution = response.data;

      return {
        jobId: executionId,
        status: this.mapN8NStatus(execution.finished, execution.stoppedAt),
        progress: this.calculateProgress(execution),
        currentStep: this.getCurrentStep(execution),
        results: execution.finished && !execution.stoppedAt ? execution.data : undefined,
        error: execution.stoppedAt ? execution.data?.resultData?.error?.message : undefined
      };
    } catch (error) {
      throw new Error(`Failed to get execution status: ${error}`);
    }
  }

  private mapN8NStatus(finished: boolean, stoppedAt: string | null): ProcessingStatus['status'] {
    if (stoppedAt) return 'failed';
    if (finished) return 'completed';
    return 'processing';
  }

  private calculateProgress(execution: any): number {
    if (!execution.data?.resultData?.runData) return 0;
    
    const totalNodes = Object.keys(execution.data.resultData.runData).length;
    const expectedNodes = 10; // Total nodes in workflow
    
    return Math.min((totalNodes / expectedNodes) * 100, 100);
  }

  private getCurrentStep(execution: any): string {
    const runData = execution.data?.resultData?.runData;
    if (!runData) return 'Starting...';

    const completedNodes = Object.keys(runData);
    const lastNode = completedNodes[completedNodes.length - 1];

    const stepMap: { [key: string]: string } = {
      'Upload Interviews Webhook': 'Processing uploads...',
      'Process Input Files': 'Analyzing files...',
      'Transcribe with Whisper': 'Transcribing audio...',
      '4P Story Analysis': 'Analyzing story structure...',
      'Update Google Spreadsheet': 'Creating spreadsheet...',
      'Create Story Summary Doc': 'Writing summary...',
      'Extract Soundbite Clips': 'Extracting clips...',
      'Create Final Story Video': 'Creating final video...'
    };

    return stepMap[lastNode] || 'Processing...';
  }

  async listActiveExecutions(): Promise<ProcessingStatus[]> {
    try {
      const response = await this.client.get('/api/v1/executions', {
        params: { filter: '{"finished": false}' }
      });

      return response.data.data.map((execution: any) => ({
        jobId: execution.id,
        status: 'processing' as const,
        progress: this.calculateProgress(execution),
        currentStep: this.getCurrentStep(execution)
      }));
    } catch (error) {
      throw new Error(`Failed to list executions: ${error}`);
    }
  }
}