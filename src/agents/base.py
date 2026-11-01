from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class AgentProfile:
    id: str
    name: str
    title: str
    description: str
    icon: str
    color: str
    system_prompt: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "icon": self.icon,
            "color": self.color
        }
