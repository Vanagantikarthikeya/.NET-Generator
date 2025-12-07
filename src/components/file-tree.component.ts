import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  level: number;
}

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col">
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Project Files</h3>
      </div>
      <div class="flex-grow p-2 overflow-y-auto">
        @for(node of fileTree(); track node.path) {
          <button (click)="onNodeClick(node)" 
                  [style.paddingLeft]="node.level * 1.25 + 'rem'"
                  [class]="'w-full text-left text-sm py-1.5 px-2 rounded-md flex items-center gap-2 ' + (node.path === selectedFile() ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800')">
            @if(node.type === 'folder') {
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            }
            <span>{{ node.name }}</span>
          </button>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileTreeComponent {
  files = input.required<{ [key: string]: string }>();
  selectedFile = input<string | null>(null);
  fileSelected = output<string>();

  // DO: Initialize signal for managing open folders state.
  openFolders = signal<Set<string>>(new Set());

  fileTree = computed(() => {
    const filePaths = Object.keys(this.files()).sort();
    const root: TreeNode[] = [];
    const map = new Map<string, TreeNode>();

    for (const path of filePaths) {
      const parts = path.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const parentPath = currentPath;
        currentPath += (currentPath ? '/' : '') + name;

        if (!map.has(currentPath)) {
          const isFile = i === parts.length - 1;
          const node: TreeNode = {
            name,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            level: i
          };
          map.set(currentPath, node);

          if (parentPath) {
            map.get(parentPath)?.children?.push(node);
          } else {
            root.push(node);
          }
        }
      }
    }
    
    const flattened: TreeNode[] = [];
    const open = this.openFolders();
    function flatten(nodes: TreeNode[]) {
      for (const node of nodes) {
        flattened.push(node);
        if (node.type === 'folder' && open.has(node.path) && node.children) {
          flatten(node.children);
        }
      }
    }

    flatten(root);
    return flattened;
  });

  onNodeClick(node: TreeNode): void {
    if (node.type === 'file') {
      this.fileSelected.emit(node.path);
    } else {
      this.openFolders.update(open => {
        const newSet = new Set(open);
        if (newSet.has(node.path)) {
          newSet.delete(node.path);
        } else {
          newSet.add(node.path);
        }
        return newSet;
      });
    }
  }
}