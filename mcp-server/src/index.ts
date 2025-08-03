import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { StorytellingTools } from './tools/storytelling-tools.js';
import { N8NClient } from './tools/n8n-client.js';
import dotenv from 'dotenv';

dotenv.config();

class StorytellingMCPServer {
  private server: Server;
  private storytellingTools: StorytellingTools;

  constructor() {
    this.server = new Server(
      {
        name: 'n8n-storytelling-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize N8N client
    const n8nBaseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
    const n8nApiKey = process.env.N8N_API_KEY || '';
    
    const n8nClient = new N8NClient(n8nBaseUrl, n8nApiKey);
    this.storytellingTools = new StorytellingTools(n8nClient);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.storytellingTools.getTools()
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'start_storytelling_analysis':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(await this.storytellingTools.executeStartAnalysis(args), null, 2)
                }
              ]
            };

          case 'get_analysis_status':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(await this.storytellingTools.executeGetStatus(args), null, 2)
                }
              ]
            };

          case 'list_active_jobs':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(await this.storytellingTools.executeListJobs(), null, 2)
                }
              ]
            };

          case 'upload_interview_files':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(await this.storytellingTools.executeUploadFiles(args), null, 2)
                }
              ]
            };

          case 'get_story_insights':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(await this.storytellingTools.executeGetInsights(args), null, 2)
                }
              ]
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2)
            }
          ],
          isError: true
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8N Storytelling MCP Server running on stdio');
  }
}

// Start the server
const server = new StorytellingMCPServer();
server.run().catch(console.error);