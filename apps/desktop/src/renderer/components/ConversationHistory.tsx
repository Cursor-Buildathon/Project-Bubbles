const conversations = ['New chat', 'Phase 1 demo', 'Sprite states'];

export function ConversationHistory() {
  return (
    <nav className="conversation-history" data-testid="conversation-history" aria-label="Conversation history">
      <h2>Conversations</h2>
      {conversations.map((conversation, index) => (
        <button className={index === 0 ? 'history-item history-item--active' : 'history-item'} key={conversation} type="button">
          {conversation}
        </button>
      ))}
    </nav>
  );
}
