import { useState, useEffect, useCallback } from 'react';
import { KeymapConfig } from './types';

const STORAGE_KEY = 'yyds_keymap_configs';

export const useKeymapStore = () => {
  const [configs, setConfigs] = useState<KeymapConfig[]>([]);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConfigs(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load keymap configs', e);
    }
  }, []);

  const saveConfigs = useCallback((newConfigs: KeymapConfig[]) => {
    setConfigs(newConfigs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfigs));
    } catch (e) {
      console.error('Failed to save keymap configs', e);
    }
  }, []);

  const saveConfig = useCallback((config: KeymapConfig) => {
    setConfigs(prev => {
      const existingIdx = prev.findIndex(c => c.id === config.id);
      let nextConfigs;
      if (existingIdx >= 0) {
        nextConfigs = [...prev];
        nextConfigs[existingIdx] = config;
      } else {
        nextConfigs = [...prev, config];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfigs));
      } catch (e) {}
      return nextConfigs;
    });
  }, []);

  const deleteConfig = useCallback((id: string) => {
    setConfigs(prev => {
      const nextConfigs = prev.filter(c => c.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfigs));
      } catch (e) {}
      return nextConfigs;
    });
  }, []);

  const exportConfig = useCallback((config: KeymapConfig) => {
    try {
      const dataStr = JSON.stringify(config, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `keymap-${config.name || 'export'}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      console.error('Export failed', e);
    }
  }, []);

  const importConfig = useCallback((file: File): Promise<KeymapConfig> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const config = JSON.parse(content) as KeymapConfig;
          
          // Basic validation
          if (!config.id || !config.nodes) {
            throw new Error('Invalid keymap file format');
          }
          
          // Generate new ID to avoid conflicts if importing the same config
          const newConfig = {
            ...config,
            id: `imported-${Date.now()}`
          };
          
          saveConfig(newConfig);
          resolve(newConfig);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [saveConfig]);

  return {
    configs,
    saveConfig,
    deleteConfig,
    exportConfig,
    importConfig
  };
};