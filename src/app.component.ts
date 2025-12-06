
import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Framework, Feature, GeneratedProject, Agent } from './models/project.model';
import { GeminiService } from './services/gemini.service';
import { CodeViewerComponent } from './components/code-viewer.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, CodeViewerComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private sanitizer = inject(DomSanitizer);

  // App State
  generationState = signal<'configuring' | 'generating' | 'completed' | 'error'>('configuring');
  isDarkMode = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Configuration State
  prompt = model<string>('');
  selectedFramework = signal<Framework | null>(null);
  selectedFeatures = signal<string[]>([]);

  // Workspace State
  generatedProject = signal<GeneratedProject | null>(null);
  activeAgents = signal<string[]>([]);
  agentLogs = signal<{ agent: Agent, message: string }[]>([]);
  
  // Code Assistant State
  assistantPrompt = model<string>('');
  chatHistory = signal<{ role: 'user' | 'assistant', content: string }[]>([]);
  isModifying = signal<boolean>(false);

  // Live Preview State
  previewableFiles = computed(() => {
    const project = this.generatedProject();
    if (!project) return [];
    return Object.keys(project.files).filter(path => path.endsWith('.html') || path.endsWith('.cshtml'));
  });
  selectedPreviewFile = signal<string | null>(null);
  safePreviewContent = computed(() => {
    const project = this.generatedProject();
    const selectedFile = this.selectedPreviewFile();
    if (project && selectedFile && project.files[selectedFile]) {
      const content = project.files[selectedFile]
        .replace(/href="~\//g, 'href="')
        .replace(/src="~\//g, 'src="');
      return this.sanitizer.bypassSecurityTrustHtml(content);
    }
    return this.sanitizer.bypassSecurityTrustHtml('<div style="font-family: sans-serif; color: #94a3b8; display: flex; align-items: center; justify-content: center; height: 100%;">Select a file to preview or no previewable file available.</div>');
  });


  constructor() {
    effect(() => {
      if (this.isDarkMode()) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    });
    this.loadTheme();
  }

  // Data definitions
  readonly AVAILABLE_FRAMEWORKS: Framework[] = [
    { value: "ASP.NET Core MVC", label: "ASP.NET Core MVC", description: "Traditional MVC web application" },
    { value: "ASP.NET Core Web API", label: "ASP.NET Core Web API", description: "RESTful API backend" },
    { value: "Razor Pages", label: "Razor Pages", description: "Page-focused framework" },
    { value: "Blazor Server", label: "Blazor Server", description: "Server-side Blazor app" },
    { value: "Blazor WebAssembly", label: "Blazor WebAssembly", description: "Client-side Blazor app" },
  ];

  readonly AVAILABLE_FEATURES: { [key: string]: Feature[] } = {
    "Security": [
      { id: "identity", label: "ASP.NET Core Identity", category: "security" },
      { id: "jwt", label: "JWT Token Authentication", category: "security" },
    ],
    "Data": [
      { id: "ef_core", label: "Entity Framework Core", category: "data" },
      { id: "dapper", label: "Dapper ORM", category: "data" },
    ],
    "API": [
      { id: "swagger", label: "Swagger/OpenAPI", category: "api" },
      { id: "signalr", label: "SignalR Real-time", category: "api" },
    ],
    "UI": [
      { id: "bootstrap", label: "Bootstrap 5", category: "ui" },
      { id: "tailwind", label: "Tailwind CSS", category: "ui" },
      { id: "clear_frontend", label: "Clear Frontend Design", category: "ui" },
    ],
    "DevOps": [
      { id: "docker", label: "Docker Configuration", category: "devops" },
    ],
    "Infrastructure": [
      { id: "logging", label: "Serilog Logging", category: "infrastructure" },
      { id: "tests", label: "Unit & Integration Tests", category: "infrastructure" },
    ],
  };
  
  readonly featureCategories = computed(() => Object.keys(this.AVAILABLE_FEATURES));

  readonly AI_AGENTS: Agent[] = [
    { id: 'team_leader', name: 'Team Leader', role: 'Project Manager', gradient: 'from-yellow-500 to-orange-500' },
    { id: 'coder', name: 'AI Coder', role: 'Backend Developer', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'frontend', name: 'UI Architect', role: 'UI/UX Developer', gradient: 'from-pink-500 to-rose-500' },
    { id: 'database', name: 'Database Admin', role: 'Data Architect', gradient: 'from-green-500 to-emerald-500' }
  ];

  isGenerationDisabled = computed(() => this.prompt().trim().length < 10 || !this.selectedFramework());

  // Methods
  loadTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkMode.set(true);
    }
  }

  toggleDarkMode(): void {
    this.isDarkMode.update(value => !value);
  }

  selectFramework(framework: Framework): void {
    this.selectedFramework.set(framework);
  }

  toggleFeature(featureId: string): void {
    this.selectedFeatures.update(currentFeatures => {
      const index = currentFeatures.indexOf(featureId);
      if (index > -1) {
        return currentFeatures.filter(id => id !== featureId);
      } else {
        return [...currentFeatures, featureId];
      }
    });
  }

  isFeatureSelected(featureId: string): boolean {
    return this.selectedFeatures().includes(featureId);
  }

  startNewProject(): void {
    this.generationState.set('configuring');
    this.prompt.set('');
    this.selectedFramework.set(null);
    this.selectedFeatures.set([]);
    this.generatedProject.set(null);
    this.agentLogs.set([]);
    this.activeAgents.set([]);
    this.chatHistory.set([]);
  }

  async handleGenerateProject(): Promise<void> {
    if (this.isGenerationDisabled()) return;

    this.generationState.set('generating');
    this.agentLogs.set([]);
    this.runAgentSimulation();

    try {
      const framework = this.selectedFramework();
      if (!framework) throw new Error("Framework not selected");
      
      const allFeatures = Object.values(this.AVAILABLE_FEATURES).flat();
      const features = allFeatures.filter(f => this.selectedFeatures().includes(f.id));
      
      const project = await this.geminiService.generateProject(this.prompt(), framework, features);
      
      this.generatedProject.set(project);
      this.generationState.set('completed');
      this.addAgentLog(this.getAgentById('team_leader'), "Project generation complete! Review the files below.");
      
      // Initialize assistant and preview
      this.chatHistory.set([{ role: 'assistant', content: "Your project is ready! I'm your code assistant. Ask me to make changes or add features." }]);
      this.selectedPreviewFile.set(this.previewableFiles()[0] || null);

    } catch (error: any) {
      this.errorMessage.set(error.message || 'An unknown error occurred.');
      this.generationState.set('error');
    } finally {
        this.activeAgents.set([]);
    }
  }

  async handleModificationRequest(): Promise<void> {
    const userPrompt = this.assistantPrompt().trim();
    if (!userPrompt || !this.generatedProject() || this.isModifying()) return;

    this.isModifying.set(true);
    this.chatHistory.update(h => [...h, { role: 'user', content: userPrompt }]);
    this.assistantPrompt.set('');

    try {
      const currentProject = this.generatedProject()!;
      const updatedProject = await this.geminiService.modifyProject(userPrompt, currentProject);
      this.generatedProject.set(updatedProject);
      
      const assistantMessage = updatedProject.explanation ? `I've updated the project: ${updatedProject.explanation}` : "I've updated the project based on your request. Please review the changes.";
      this.chatHistory.update(h => [...h, { role: 'assistant', content: assistantMessage }]);

      // Re-check selected preview file in case it was renamed or deleted
      if (this.selectedPreviewFile() && !this.previewableFiles().includes(this.selectedPreviewFile()!)) {
        this.selectedPreviewFile.set(this.previewableFiles()[0] || null);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unknown error occurred.';
      this.errorMessage.set(errorMessage);
      this.chatHistory.update(h => [...h, { role: 'assistant', content: `I encountered an error: ${errorMessage}` }]);
    } finally {
      this.isModifying.set(false);
    }
  }

  private getAgentById(id: string): Agent {
    return this.AI_AGENTS.find(a => a.id === id)!;
  }

  private addAgentLog(agent: Agent, message: string): void {
    this.agentLogs.update(logs => [...logs, { agent, message }]);
  }

  private async runAgentSimulation(): Promise<void> {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const teamLeader = this.getAgentById('team_leader');
    const coder = this.getAgentById('coder');
    const frontend = this.getAgentById('frontend');
    const dbAdmin = this.getAgentById('database');

    this.activeAgents.set([teamLeader.id]);
    this.addAgentLog(teamLeader, "Analyzing project requirements...");
    await delay(1500);

    this.addAgentLog(teamLeader, "Assembling AI development team...");
    this.activeAgents.set([teamLeader.id, coder.id, frontend.id, dbAdmin.id]);
    await delay(1000);

    this.addAgentLog(coder, "Scaffolding backend structure...");
    await delay(2000);

    this.addAgentLog(dbAdmin, "Designing database schema...");
    await delay(1500);

    this.addAgentLog(frontend, "Planning UI components...");
    await delay(1800);

    this.addAgentLog(teamLeader, "Team is now generating the full codebase. This may take a moment...");
  }

  retry(): void {
    this.generationState.set('configuring');
    this.errorMessage.set('');
  }
}
