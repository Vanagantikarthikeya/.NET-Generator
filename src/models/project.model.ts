
export interface Framework {
  value: string;
  label: string;
  description: string;
}

export interface Feature {
  id: string;
  label: string;
  category: 'security' | 'data' | 'api' | 'ui' | 'devops' | 'infrastructure';
}

export interface GeneratedProject {
  files: { [key: string]: string };
  dependencies: string[];
  explanation: string;
  build_commands: string[];
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    gradient: string;
}
