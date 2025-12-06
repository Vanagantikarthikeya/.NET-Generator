
import { Component, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeneratedProject } from '../models/project.model';

@Component({
  selector: 'app-code-viewer',
  imports: [CommonModule],
  template: `
    @if (project(); as proj) {
      <div class="flex h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
        <!-- File Tree -->
        <div class="w-1/3 md:w-1/4 h-full bg-slate-950 p-4 overflow-y-auto">
          <h3 class="text-lg font-semibold text-white mb-4">Project Files</h3>
          <ul class="space-y-1">
            @for (file of filePaths(); track file) {
              <li>
                <button (click)="selectFile(file)" 
                        [class]="'w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ' + (selectedFile() === file ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800')">
                  {{ getFileName(file) }}
                  <span class="block text-xs text-slate-500">{{ getFileDirectory(file) }}</span>
                </button>
              </li>
            }
          </ul>
        </div>

        <!-- Code Content -->
        <div class="w-2/3 md:w-3/4 h-full flex flex-col">
          @if (selectedFileContent(); as content) {
            <div class="flex-shrink-0 bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
              <span class="text-sm font-mono text-slate-300">{{ selectedFile() }}</span>
              <button (click)="copyToClipboard(content)" 
                      class="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                {{ copyButtonText() }}
              </button>
            </div>
            <div class="flex-grow overflow-auto">
              <pre class="h-full"><code class="text-sm p-4 block text-slate-200 whitespace-pre-wrap">{{ content }}</code></pre>
            </div>
          } @else {
            <div class="w-full h-full flex items-center justify-center text-slate-500">
              <p>Select a file to view its content</p>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeViewerComponent {
  project = input.required<GeneratedProject>();

  selectedFile = signal<string | null>(null);
  copyButtonText = signal('Copy');

  filePaths = computed(() => Object.keys(this.project()?.files || {}).sort());
  selectedFileContent = computed(() => {
    const fileKey = this.selectedFile();
    if (fileKey) {
      return this.project().files[fileKey];
    }
    return null;
  });

  selectFile(filePath: string): void {
    this.selectedFile.set(filePath);
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  getFileDirectory(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || './';
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copyButtonText.set('Copied!');
      setTimeout(() => this.copyButtonText.set('Copy'), 2000);
    });
  }
}
