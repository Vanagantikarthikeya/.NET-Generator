
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { Framework, Feature, GeneratedProject } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly ai: GoogleGenAI;

  constructor() {
    // IMPORTANT: The API key is injected via environment variables.
    // Do not hardcode or expose it in the frontend.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY environment variable not set.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async callGenerativeModel(fullPrompt: string, originalPrompt: string, framework: Framework): Promise<GeneratedProject> {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              files: {
                type: Type.ARRAY,
                description: 'An array of objects, where each object represents a file with its path and content.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: {
                      type: Type.STRING,
                      description: 'The full path of the file (e.g., "Controllers/HomeController.cs").'
                    },
                    content: {
                      type: Type.STRING,
                      description: 'The code content of the file.'
                    }
                  },
                  required: ['path', 'content']
                }
              },
              dependencies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of NuGet package names required for the project.'
              },
              explanation: {
                type: Type.STRING,
                description: 'A brief explanation of the generated project structure and key files.'
              },
              build_commands: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of CLI commands to build and run the project.'
              }
            },
            required: ["files", "dependencies", "explanation", "build_commands"],
          },
        },
      });

      const jsonString = response.text.trim();
      const rawResponse: {
        files: { path: string; content: string }[];
        dependencies: string[];
        explanation: string;
        build_commands: string[];
      } = JSON.parse(jsonString);

      // Transform the files array into the dictionary format the app expects
      const filesDictionary = rawResponse.files.reduce((acc, file) => {
        if (file.path && file.content) {
          acc[file.path] = file.content;
        }
        return acc;
      }, {} as { [key: string]: string });
      
      const projectName = originalPrompt.length > 50 ? originalPrompt.substring(0, 47) + '...' : originalPrompt;

      const generatedProject: GeneratedProject = {
        id: new Date().toISOString() + Math.random(),
        name: projectName,
        prompt: originalPrompt,
        framework: framework,
        files: filesDictionary,
        dependencies: rawResponse.dependencies,
        explanation: rawResponse.explanation,
        build_commands: rawResponse.build_commands,
      };
      
      // Basic validation
      if (Object.keys(generatedProject.files).length === 0) {
        throw new Error('AI response is missing valid file structure.');
      }

      return generatedProject;
  }

  async generateProject(prompt: string, framework: Framework, features: Feature[]): Promise<GeneratedProject> {
    const featureList = features.map(f => f.label).join(', ');
    const hasClearFrontend = features.some(f => f.id === 'clear_frontend');
    
    const frontendInstruction = hasClearFrontend
      ? `- **Frontend Design:** The user has requested a "Clear Frontend Design". Generate a visually appealing, modern, and user-friendly frontend using HTML and Tailwind CSS (if no other UI framework is specified). This should include a clean layout, a professional color scheme, and interactive elements. The UI should look professional, not like a barebones wireframe.`
      : `- **Frontend Design:** Generate basic, functional HTML/CSHTML for the required views. The focus is on functionality.`;

    const fullPrompt = `
      You are an expert .NET architect. Your task is to generate a complete, production-ready ASP.NET Core project.

      **Project Requirements:**
      - **User Prompt:** "${prompt}"
      - **Framework:** "${framework.label}"
      - **Selected Features:** ${featureList.length > 0 ? featureList : 'None'}
      ${frontendInstruction}

      **Instructions:**
      1.  Generate a complete file structure and the code for each file.
      2.  List all necessary NuGet packages.
      3.  Provide the CLI commands to build and run the project.
      4.  Briefly explain the project structure.
      5.  Return the entire output as a single, valid JSON object matching the provided schema. Do not include any markdown formatting like \`\`\`json.
    `;

    try {
      return await this.callGenerativeModel(fullPrompt, prompt, framework);
    } catch (error) {
      console.error("Error calling Gemini API for generation:", error);
      throw new Error("Failed to generate project. The AI model may be overloaded or the request was invalid. Please check your prompt and try again.");
    }
  }

  async modifyProject(prompt: string, existingProject: GeneratedProject): Promise<GeneratedProject> {
    // Prune large, unnecessary fields before sending back to the AI
    const slimProject = { ...existingProject, prompt: undefined, framework: undefined };
    
    const fullPrompt = `
      You are an expert AI .NET developer. You will be given an existing .NET project as a JSON object and a user request for modification.
      Your task is to apply the requested changes and return the *entire*, updated project structure in the exact same JSON format.
      Do not just return the changed files; return all files, whether modified or not. Your response must be the complete project.

      **User Request for Modification:**
      "${prompt}"

      **Existing Project JSON:**
      ${JSON.stringify(slimProject)}

      Now, provide the complete and updated project as a single, valid JSON object matching the required schema. The 'explanation' field in the JSON should describe the changes you made.
    `;
    
    try {
        const modifiedCore = await this.callGenerativeModel(fullPrompt, existingProject.prompt, existingProject.framework);
        // Preserve original ID and other metadata
        return {
          ...existingProject,
          files: modifiedCore.files,
          dependencies: modifiedCore.dependencies,
          explanation: modifiedCore.explanation,
          build_commands: modifiedCore.build_commands,
        };
    } catch (error) {
        console.error("Error calling Gemini API for modification:", error);
        throw new Error("Failed to modify project. The AI model may be overloaded or the request was invalid.");
    }
  }
}
