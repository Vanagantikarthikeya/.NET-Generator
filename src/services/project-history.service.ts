
import { Injectable } from '@angular/core';
import { GeneratedProject } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectHistoryService {
  private readonly STORAGE_KEY = 'dotnet-builder-projects';

  getProjects(): GeneratedProject[] {
    try {
      const projectsJson = localStorage.getItem(this.STORAGE_KEY);
      if (projectsJson) {
        return JSON.parse(projectsJson);
      }
    } catch (e) {
      console.error('Error reading projects from localStorage', e);
    }
    return [];
  }

  getProject(id: string): GeneratedProject | null {
    const projects = this.getProjects();
    return projects.find(p => p.id === id) || null;
  }

  saveProject(project: GeneratedProject): void {
    try {
      const projects = this.getProjects();
      const existingIndex = projects.findIndex(p => p.id === project.id);
      
      if (existingIndex > -1) {
        projects[existingIndex] = project;
      } else {
        projects.unshift(project); // Add new projects to the top
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Error saving project to localStorage', e);
    }
  }

  deleteProject(id: string): void {
    try {
      let projects = this.getProjects();
      projects = projects.filter(p => p.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Error deleting project from localStorage', e);
    }
  }
}
