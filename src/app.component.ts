
import { Component, ChangeDetectionStrategy, signal, computed, effect, inject, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Framework, Feature, GeneratedProject, Agent } from './models/project.model';
import { GeminiService } from './services/gemini.service';
import { ProjectHistoryService } from './services/project-history.service';
import { FileTreeComponent } from './components/file-tree.component';
import { CodeAreaComponent } from './components/code-area.component';

type AppState = 'landing' | 'configuring' | 'generating' | 'completed' | 'my_projects' | 'error';
type WorkspaceTab = 'assistant' | 'preview' | 'info';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, FileTreeComponent, CodeAreaComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private sanitizer = inject(DomSanitizer);
  private projectHistoryService = inject(ProjectHistoryService);

  // App State
  appState = signal<AppState>('landing');
  isDarkMode = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Configuration State
  prompt = model<string>('');
  selectedFramework = signal<Framework | null>(null);
  selectedFeatures = signal<string[]>([]);

  // Workspace State
  projectHistory = signal<GeneratedProject[]>([]);
  activeProject = signal<GeneratedProject | null>(null);
  activeAgents = signal<string[]>([]);
  agentLogs = signal<{ agent: Agent, message: string }[]>([]);
  selectedFile = signal<string | null>(null);
  activeWorkspaceTab = signal<WorkspaceTab>('assistant');
  
  // Code Assistant State
  assistantPrompt = model<string>('');
  chatHistory = signal<{ role: 'user' | 'assistant', content: string }[]>([]);
  isModifying = signal<boolean>(false);

  // Computed Values
  selectedFileContent = computed(() => {
    const project = this.activeProject();
    const file = this.selectedFile();
    if (project && file && project.files[file]) {
      return project.files[file];
    }
    return null;
  });

  previewableFiles = computed(() => {
    const project = this.activeProject();
    if (!project) return [];
    return Object.keys(project.files).filter(path => path.endsWith('.html') || path.endsWith('.cshtml'));
  });

  selectedPreviewFile = signal<string | null>(null);

  safePreviewContent = computed<SafeHtml>(() => {
    const project = this.activeProject();
    const selectedFile = this.selectedPreviewFile();
    if (project && selectedFile && project.files[selectedFile]) {
      const content = project.files[selectedFile]
        .replace(/href="~\//g, 'href="')
        .replace(/src="~\//g, 'src="');
      return this.sanitizer.bypassSecurityTrustHtml(content);
    }
    return this.sanitizer.bypassSecurityTrustHtml('<div class="font-sans text-slate-400 flex items-center justify-center h-full">Select a file to preview</div>');
  });

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDarkMode());
      localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
    });
    this.loadTheme();
    this.loadProjects();
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
    "Security": [{ id: "identity", label: "ASP.NET Core Identity", category: "security" }, { id: "jwt", label: "JWT Token Authentication", category: "security" }],
    "Data": [{ id: "ef_core", label: "Entity Framework Core", category: "data" }, { id: "dapper", label: "Dapper ORM", category: "data" }],
    "API": [{ id: "swagger", label: "Swagger/OpenAPI", category: "api" }, { id: "signalr", label: "SignalR Real-time", category: "api" }],
    "UI": [{ id: "bootstrap", label: "Bootstrap 5", category: "ui" }, { id: "tailwind", label: "Tailwind CSS", category: "ui" }, { id: "clear_frontend", label: "Clear Frontend Design", category: "ui" }],
    "DevOps": [{ id: "docker", label: "Docker Configuration", category: "devops" }],
    "Infrastructure": [{ id: "logging", label: "Serilog Logging", category: "infrastructure" }, { id: "tests", label: "Unit & Integration Tests", category: "infrastructure" }],
  };
  
  readonly featureCategories = computed(() => Object.keys(this.AVAILABLE_FEATURES));
  readonly AI_AGENTS: Agent[] = [
    { id: 'team_leader', name: 'Team Leader', role: 'Project Manager', gradient: 'from-yellow-500 to-orange-500' },
    { id: 'coder', name: 'AI Coder', role: 'Backend Developer', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'frontend', name: 'UI Architect', role: 'UI/UX Developer', gradient: 'from-pink-500 to-rose-500' },
    { id: 'database', name: 'Database Admin', role: 'Data Architect', gradient: 'from-green-500 to-emerald-500' }
  ];
  isGenerationDisabled = computed(() => this.prompt().trim().length < 10 || !this.selectedFramework());

  // --- App Flow and State Management ---
  loadTheme(): void {
    this.isDarkMode.set(localStorage.getItem('theme') === 'dark');
  }

  loadProjects(): void {
    this.projectHistory.set(this.projectHistoryService.getProjects());
  }

  setAppState(state: AppState): void {
    this.appState.set(state);
    if (state === 'configuring') {
      this.resetConfiguration();
    }
  }
  
  startNewProjectFlow(): void {
    this.resetConfiguration();
    this.appState.set('configuring');
  }

  resetConfiguration(): void {
    this.prompt.set('');
    this.selectedFramework.set(null);
    this.selectedFeatures.set([]);
    this.activeProject.set(null);
    this.agentLogs.set([]);
    this.activeAgents.set([]);
    this.chatHistory.set([]);
  }
  
  loadProject(projectId: string): void {
    const project = this.projectHistoryService.getProject(projectId);
    if (project) {
      this.activeProject.set(project);
      this.appState.set('completed');
      this.initializeWorkspace(false);
    }
  }
  
  deleteProject(projectId: string): void {
    this.projectHistoryService.deleteProject(projectId);
    this.loadProjects();
    if(this.activeProject()?.id === projectId) {
      this.activeProject.set(null);
      this.setAppState('landing');
    }
  }

  // --- UI Interaction ---
  toggleDarkMode(): void { this.isDarkMode.update(v => !v); }
  selectFramework(framework: Framework): void { this.selectedFramework.set(framework); }
  toggleFeature(featureId: string): void {
    this.selectedFeatures.update(current => 
      current.includes(featureId) ? current.filter(id => id !== featureId) : [...current, featureId]
    );
  }
  isFeatureSelected(featureId: string): boolean { return this.selectedFeatures().includes(featureId); }
  selectFile(filePath: string): void { this.selectedFile.set(filePath); }

  // --- Project Generation ---
  async handleGenerateProject(): Promise<void> {
    if (this.isGenerationDisabled()) return;

    this.appState.set('generating');
    this.agentLogs.set([]);
    this.runAgentSimulation();

    try {
      const framework = this.selectedFramework();
      if (!framework) throw new Error("Framework not selected");
      
      const allFeatures = Object.values(this.AVAILABLE_FEATURES).flat();
      const features = allFeatures.filter(f => this.selectedFeatures().includes(f.id));
      
      const projectData = {
        prompt: this.prompt(),
        framework,
      };

      const project = await this.geminiService.generateProject(projectData.prompt, projectData.framework, features);
      
      this.activeProject.set(project);
      this.projectHistoryService.saveProject(project);
      this.loadProjects();

      this.appState.set('completed');
      this.addAgentLog(this.getAgentById('team_leader'), "Project generation complete! Review the files below.");
      
      this.initializeWorkspace(true);

    } catch (error: any) {
      this.errorMessage.set(error.message || 'An unknown error occurred.');
      this.appState.set('error');
    } finally {
        this.activeAgents.set([]);
    }
  }

  // --- Workspace & Code Assistant ---
  initializeWorkspace(isNew: boolean): void {
    if (isNew) {
      this.chatHistory.set([{ role: 'assistant', content: "Your project is ready! I'm your code assistant. Ask me to make changes or add features." }]);
    } else {
      this.chatHistory.set([{ role: 'assistant', content: `Loaded project "${this.activeProject()?.name}". How can I help you modify it?`}]);
    }

    const firstFile = Object.keys(this.activeProject()?.files || {})[0] || null;
    this.selectFile(firstFile);

    const firstPreview = this.previewableFiles()[0] || null;
    this.selectedPreviewFile.set(firstPreview);
    this.activeWorkspaceTab.set('assistant');
  }

  async handleModificationRequest(): Promise<void> {
    const userPrompt = this.assistantPrompt().trim();
    if (!userPrompt || !this.activeProject() || this.isModifying()) return;

    this.isModifying.set(true);
    this.chatHistory.update(h => [...h, { role: 'user', content: userPrompt }]);
    this.assistantPrompt.set('');

    try {
      const currentProject = this.activeProject()!;
      const updatedProject = await this.geminiService.modifyProject(userPrompt, currentProject);
      
      this.activeProject.set(updatedProject);
      this.projectHistoryService.saveProject(updatedProject);
      this.loadProjects();
      
      const assistantMessage = updatedProject.explanation ? `I've updated the project: ${updatedProject.explanation}` : "I've updated the project based on your request. Please review the changes.";
      this.chatHistory.update(h => [...h, { role: 'assistant', content: assistantMessage }]);

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

  // --- Agent Simulation ---
  private getAgentById(id: string): Agent {
    return this.AI_AGENTS.find(a => a.id === id)!;
  }
  private addAgentLog(agent: Agent, message: string): void {
    this.agentLogs.update(logs => [...logs, { agent, message }]);
  }
  private async runAgentSimulation(): Promise<void> {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const [teamLeader, coder, frontend, dbAdmin] = [this.getAgentById('team_leader'), this.getAgentById('coder'), this.getAgentById('frontend'), this.getAgentById('database')];

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
}
