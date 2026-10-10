import { describe, expect, it, vi } from 'vitest';
import { canShowSuggestedPrompts, getDisplayName, getSuggestedPrompts } from '../ChatArea';
import { createSuggestedPromptHandler } from '../../../pages/CustomBotsPage';

const assistantIndex = 1;

describe('getSuggestedPrompts', () => {
  it('turns an email username into a readable display name', () => {
    expect(getDisplayName('rahul.sharma@example.com')).toBe('Rahul Sharma');
    expect(getDisplayName('rahul_sharma@example.com')).toBe('Rahul Sharma');
  });

  it('changes actions for summary questions', () => {
    const prompts = getSuggestedPrompts([
      { id: 'user-1', role: 'user', content: 'Give me a summary of this policy' },
      { id: 'assistant-1', role: 'assistant', content: 'The policy covers employee leave requests and approval steps.' },
    ], assistantIndex, 1);

    expect(prompts).toEqual([
      'Can you provide more details from the document?',
      'Are there any exceptions or conditions mentioned?',
    ]);
  });

  it('offers conflict-focused actions for comparisons', () => {
    const prompts = getSuggestedPrompts([
      { id: 'user-1', role: 'user', content: 'Compare these documents' },
      { id: 'assistant-1', role: 'assistant', content: 'Comparison' },
    ], assistantIndex, 2);

    expect(prompts).toEqual([
      'Can you provide more details from the document?',
      'Are there any exceptions or conditions mentioned?',
    ]);
  });

  it('uses explanation actions for explanatory questions', () => {
    const prompts = getSuggestedPrompts([
      { id: 'user-1', role: 'user', content: 'What does this say?' },
      { id: 'assistant-1', role: 'assistant', content: 'Answer' },
    ], assistantIndex, 2);

    expect(prompts).toEqual([
      'Can you provide more details from the document?',
      'Are there any exceptions or conditions mentioned?',
    ]);
  });

  it('builds fallback actions from the current conversation when no documents are attached', () => {
    const prompts = getSuggestedPrompts([
      { id: 'user-1', role: 'user', content: 'Tell me about project planning' },
      { id: 'assistant-1', role: 'assistant', content: 'Planning helps...' },
    ], assistantIndex, 0);

    expect(prompts).toEqual([
      'Can you explain "Tell me about project planning" in more detail?',
      'What is the practical next step for "Tell me about project planning"?',
    ]);
  });

  it('shows no suggestions when documents are attached and no questions are present in the response', () => {
    expect(getSuggestedPrompts([
      { id: 'user-1', role: 'user', content: 'Summarize the HR SOP' },
      { id: 'assistant-1', role: 'assistant', content: 'Summary' },
    ], assistantIndex, 1)).toEqual([]);
  });

  it('shows no suggestions even if questions are present in the assistant response when documents are attached', () => {
    expect(getSuggestedPrompts([
      { id: 'user-1', role: 'user', content: 'Summarize the HR SOP' },
      { id: 'assistant-1', role: 'assistant', content: 'Here are some questions: 1. What is the policy? 2. How to apply?' },
    ], assistantIndex, 1)).toEqual([]);
  });

  it('sends a chosen suggestion through the custom bot prompt handler', () => {
    const sendMessage = vi.fn();
    const onSuggestedPrompt = createSuggestedPromptHandler(sendMessage);

    onSuggestedPrompt('Summarize the relevant section');

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith('Summarize the relevant section');
  });

  it('shows follow-up suggestions in custom bot chat even without documents', () => {
    const messages = [
      { id: 'user-1', role: 'user', content: 'Tell me about the project plan' },
      { id: 'assistant-1', role: 'assistant', content: 'The project plan is structured and clear.' },
    ];

    expect(canShowSuggestedPrompts(messages, 1, false, messages[1])).toBe(true);
    expect(getSuggestedPrompts(messages, 1, 0)).toEqual([
      'Can you explain "Tell me about the project plan" in more detail?',
      'What is the practical next step for "Tell me about the project plan"?',
    ]);
  });

  it('does not add another suggestion chain after a clarification reply', () => {
    const messages = [
      { id: 'user-1', role: 'user' as const, content: 'What is the next useful question to ask?' },
      { id: 'assistant-1', role: 'assistant' as const, content: 'Could you please specify the context or field you would like assistance with?' },
    ];

    expect(getSuggestedPrompts(messages, 1, 0)).toEqual([]);
  });
});
