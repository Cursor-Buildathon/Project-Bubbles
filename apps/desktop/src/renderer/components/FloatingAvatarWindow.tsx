import { PointerEvent, useRef, useState } from 'react';
import { AvatarStage } from '../../avatar/AvatarStage';
import { type AvatarState } from '../../avatar/animationCatalog';

interface FloatingAvatarWindowProps {
  activeAgentBadge: string;
  avatarState: AvatarState;
  latestBubbleText: string;
  onTogglePanel: () => void;
  panelOpen: boolean;
}

export function FloatingAvatarWindow({
  activeAgentBadge,
  avatarState,
  latestBubbleText,
  onTogglePanel,
  panelOpen
}: FloatingAvatarWindowProps) {
  const dragRef = useRef({
    active: false,
    moved: false,
    x: 0,
    y: 0
  });
  const [isDropTarget, setIsDropTarget] = useState(false);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    dragRef.current = {
      active: true,
      moved: false,
      x: event.screenX,
      y: event.screenY
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag.active) {
      return;
    }

    const delta = {
      x: event.screenX - drag.x,
      y: event.screenY - drag.y
    };

    if (Math.abs(delta.x) + Math.abs(delta.y) < 2) {
      return;
    }

    dragRef.current = {
      active: true,
      moved: true,
      x: event.screenX,
      y: event.screenY
    };
    void window.bubbles?.moveWindowBy(delta);
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;

    if (event.target instanceof Element && event.target.closest('.avatar-button')) {
      return;
    }

    if (!wasMoved) {
      onTogglePanel();
    }
  }

  function handleAvatarClick() {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    onTogglePanel();
  }

  return (
    <section
      className={isDropTarget ? 'floating-avatar-window floating-avatar-window--drop-target' : 'floating-avatar-window'}
      data-testid="floating-avatar-window"
      aria-label="Floating Bubbles avatar"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setIsDropTarget(false);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="speech-bubble speech-bubble--glass" data-testid="speech-bubble">
        {latestBubbleText}
      </div>

      <button
        aria-expanded={panelOpen}
        aria-label="Open Bubbles assistant panel"
        className="avatar-button"
        onClick={handleAvatarClick}
        title="Open Bubbles"
        type="button"
      >
        <AvatarStage state={avatarState} />
      </button>

      <div className="floating-status-row">
        <span className="pet-name" data-testid="active-agent-badge">
          {activeAgentBadge}
        </span>
      </div>
    </section>
  );
}
