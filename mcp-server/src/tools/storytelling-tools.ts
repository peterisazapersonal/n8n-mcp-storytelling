import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { N8NClient } from './n8n-client';
import { StoryAnalysisRequest, ProcessingStatus, StoryTheme } from '../types/storytelling';
import { v4 as uuidv4 } from 'uuid';

export class StorytellingTools {
  private n8nClient: N8NClient;
  private jobs: Map<string, ProcessingStatus> = new Map();

  constructor(n8nClient: N8NClient) {
    this.n8nClient = n8nClient;
  }

  getTools(): Tool[] {
    return [
      {
        name: 'start_storytelling_analysis',
        description: 'Start analysis of interview files using the Still Motion Muse 4P framework (People, Places, Purpose, Plot). Processes audio/video files to create story analysis with soundbites, summaries, and video clips.',
        inputSchema: {
          type: 'object',
          properties: {
            themes: {
              type: 'array',
              description: 'Key themes to explore in the storytelling analysis',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Theme name' },
                  description: { type: 'string', description: 'Theme description' },
                  priority: { 
                    type: 'string', 
                    enum: ['high', 'medium', 'low'],
                    description: 'Theme priority level'
                  }
                },
                required: ['name']
              }
            },
            outputOptions: {
              type: 'object',
              description: 'Configuration for output deliverables',
              properties: {
                createSpreadsheet: { 
                  type: 'boolean', 
                  description: 'Create Google Spreadsheet with timestamped soundbites',
                  default: true
                },
                createSummary: { 
                  type: 'boolean', 
                  description: 'Create written story summaries',
                  default: true
                },
                createVideoClips: { 
                  type: 'boolean', 
                  description: 'Extract video/audio clips and create final sequence',
                  default: true
                },
                language: { 
                  type: 'string', 
                  description: 'Target language for translation (default: English)',
                  default: 'en'
                }
              }
            },
            fileUrls: {
              type: 'array',
              description: 'URLs or file paths of interview audio/video files to analyze',
              items: { type: 'string' }
            }
          },
          required: ['themes', 'fileUrls']
        }
      },
      {
        name: 'get_analysis_status',
        description: 'Check the status of a storytelling analysis job and retrieve results when completed.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Job ID returned from start_storytelling_analysis'
            }
          },
          required: ['jobId']
        }
      },
      {
        name: 'list_active_jobs',
        description: 'List all currently active storytelling analysis jobs.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'upload_interview_files',
        description: 'Upload interview files (audio/video) to the processing system. Returns file information for use in analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              description: 'Array of file objects with content and metadata',
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string', description: 'Original filename' },
                  content: { type: 'string', description: 'Base64 encoded file content' },
                  mimeType: { type: 'string', description: 'MIME type of the file' }
                },
                required: ['filename', 'content', 'mimeType']
              }
            }
          },
          required: ['files']
        }
      },
      {
        name: 'get_story_insights',
        description: 'Get detailed insights from completed story analysis, including 4P breakdown, emotional moments, and transformation arcs.',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Job ID of completed analysis'
            },
            insightType: {
              type: 'string',
              enum: ['people', 'places', 'purpose', 'plot', 'soundbites', 'transformation', 'all'],
              description: 'Type of insights to retrieve',
              default: 'all'
            }
          },
          required: ['jobId']
        }
      }
    ];
  }

  async executeStartAnalysis(args: any): Promise<any> {
    try {
      const { themes, outputOptions = {}, fileUrls } = args;

      // Convert file URLs to file objects (simplified - in real implementation, would download/process files)
      const files = fileUrls.map((url: string, index: number) => ({
        filename: `interview_${index + 1}.${url.split('.').pop()}`,
        filepath: url,
        size: 0, // Would be determined during processing
        mimeType: this.getMimeTypeFromUrl(url)
      }));

      const request: StoryAnalysisRequest = {
        files,
        themes: themes.map((theme: any) => ({
          name: theme.name,
          description: theme.description || '',
          priority: theme.priority || 'medium'
        })),
        outputOptions: {
          createSpreadsheet: outputOptions.createSpreadsheet !== false,
          createSummary: outputOptions.createSummary !== false,
          createVideoClips: outputOptions.createVideoClips !== false,
          language: outputOptions.language || 'en'
        }
      };

      const executionId = await this.n8nClient.startStorytellingWorkflow(request);
      
      const status: ProcessingStatus = {
        jobId: executionId,
        status: 'pending',
        progress: 0,
        currentStep: 'Initializing analysis...'
      };

      this.jobs.set(executionId, status);

      return {
        success: true,
        jobId: executionId,
        message: 'Storytelling analysis started successfully',
        estimatedDuration: '10-30 minutes depending on file sizes',
        themes: themes.map((t: any) => t.name),
        fileCount: files.length
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to start analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async executeGetStatus(args: any): Promise<any> {
    try {
      const { jobId } = args;
      
      const status = await this.n8nClient.getExecutionStatus(jobId);
      this.jobs.set(jobId, status);

      if (status.status === 'completed' && status.results) {
        return {
          success: true,
          status: status.status,
          progress: status.progress,
          currentStep: status.currentStep,
          results: {
            analysis: status.results.analysis,
            deliverables: status.results.deliverables,
            summary: this.generateResultSummary(status.results.analysis)
          }
        };
      }

      return {
        success: true,
        status: status.status,
        progress: status.progress,
        currentStep: status.currentStep,
        error: status.error
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async executeListJobs(): Promise<any> {
    try {
      const activeJobs = await this.n8nClient.listActiveExecutions();
      
      return {
        success: true,
        activeJobs: activeJobs.map(job => ({
          jobId: job.jobId,
          status: job.status,
          progress: job.progress,
          currentStep: job.currentStep
        })),
        totalActive: activeJobs.length
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list jobs: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async executeUploadFiles(args: any): Promise<any> {
    try {
      const { files } = args;
      
      // Convert base64 files to multer-like objects
      const multerFiles = files.map((file: any) => ({
        originalname: file.filename,
        buffer: Buffer.from(file.content, 'base64'),
        mimetype: file.mimeType,
        size: Buffer.from(file.content, 'base64').length
      }));

      const uploadedPaths = await this.n8nClient.uploadFiles(multerFiles);

      return {
        success: true,
        message: 'Files uploaded successfully',
        files: uploadedPaths.map((path, index) => ({
          filename: files[index].filename,
          filepath: path,
          size: multerFiles[index].size,
          mimeType: files[index].mimeType
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async executeGetInsights(args: any): Promise<any> {
    try {
      const { jobId, insightType = 'all' } = args;
      
      const status = await this.n8nClient.getExecutionStatus(jobId);
      
      if (status.status !== 'completed' || !status.results) {
        return {
          success: false,
          error: 'Analysis not completed yet or no results available'
        };
      }

      const analysis = status.results.analysis;
      
      switch (insightType) {
        case 'people':
          return { success: true, insights: analysis.people };
        case 'places':
          return { success: true, insights: analysis.places };
        case 'purpose':
          return { success: true, insights: analysis.purpose };
        case 'plot':
          return { success: true, insights: analysis.plot };
        case 'soundbites':
          return { success: true, insights: analysis.soundbites };
        case 'transformation':
          return { success: true, insights: this.extractTransformationInsights(analysis) };
        default:
          return { success: true, insights: analysis };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to get insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private getMimeTypeFromUrl(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase();
    const mimeMap: { [key: string]: string } = {
      'mp4': 'video/mp4',
      'avi': 'video/avi',
      'mov': 'video/quicktime',
      'mp3': 'audio/mp3',
      'wav': 'audio/wav',
      'flac': 'audio/flac'
    };
    return mimeMap[ext || ''] || 'application/octet-stream';
  }

  private generateResultSummary(analysis: any): string {
    return `Analysis completed with ${analysis.soundbites?.length || 0} soundbites identified across ${analysis.people?.length || 0} key characters. The story explores themes of transformation through ${analysis.purpose?.length || 0} core purposes across ${analysis.places?.length || 0} significant locations.`;
  }

  private extractTransformationInsights(analysis: any): any {
    return {
      transformationMoments: analysis.plot?.filter((p: any) => p.significance.includes('transformation')),
      keyCharacterArcs: analysis.people?.map((person: any) => ({
        character: person.name,
        transformation: person.significance
      })),
      emotionalHighpoints: analysis.soundbites?.filter((s: any) => s.emotionalImpact > 7)
    };
  }
}