
import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-code-area',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (fileName(); as name) {
      <div class="h-full flex flex-col bg-slate-950">
        <div class="flex-shrink-0 bg-slate-100 dark:bg-slate-900 p-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
          <span class="text-sm font-mono text-slate-600 dark:text-slate-300">{{ name }}</span>
          @if (fileContent() !== null) {
            <button (click)="copyToClipboard(fileContent()!)" 
                    class="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              {{ copyButtonText() }}
            </button>
          }
        </div>
        <div class="flex-grow overflow-auto">
          @if(fileContent(); as content) {
            <pre class="h-full selection:bg-blue-500/20"><code class="text-sm p-4 block text-slate-300 whitespace-pre-wrap font-mono">{{ content }}</code></pre>
          } @else {
             <div class="w-full h-full flex items-center justify-center text-slate-500">
              <p>File content is empty or could not be loaded.</p>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="w-full h-full flex items-center justify-center text-slate-500 bg-slate-950">
        <p>Select a file to view its content</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeAreaComponent {
  fileName = input<string | null>(null);
  fileContent = input<string | null>(null);

  copyButtonText = signal('Copy');

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copyButtonText.set('Copied!');
      setTimeout(() => this.copyButtonText.set('Copy'), 2000);
    });
  }
}
