import { describe, expect, it } from 'vitest';
import { classifyApprovalRisk } from './riskClassifier.js';

describe('classifyApprovalRisk', () => {
  it('marks sensitive write and external actions as high risk', () => {
    expect(classifyApprovalRisk('file_write')).toBe('high');
    expect(classifyApprovalRisk('shell_command')).toBe('high');
    expect(classifyApprovalRisk('external_data_send')).toBe('high');
  });

  it('marks agent file creation as medium risk and read-only actions as low risk', () => {
    expect(classifyApprovalRisk('agent_file_create')).toBe('medium');
    expect(classifyApprovalRisk('tavily_research')).toBe('low');
    expect(classifyApprovalRisk('local_file_read')).toBe('low');
  });
});
