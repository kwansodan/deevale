import logging
from collections import defaultdict
from collections.abc import Callable

from app.core.events.events import DomainEvent

logger = logging.getLogger(__name__)


class DomainEventBus:
    """In-process, synchronous domain event dispatcher.

    Handlers run in registration order, in the same thread/transaction as the
    caller. Handlers needing slow I/O (email, PDF generation, SMS) must do
    their own hand-off to a Celery task as their last synchronous step -- the
    bus itself has no knowledge of Celery, so it stays trivially testable.
    """

    def __init__(self):
        self._handlers: dict[str, list[Callable[[DomainEvent], None]]] = defaultdict(list)

    def register(self, event_type: str, handler: Callable[[DomainEvent], None]) -> None:
        if handler in self._handlers[event_type]:
            return
        self._handlers[event_type].append(handler)

    def dispatch(self, event: DomainEvent) -> None:
        for handler in self._handlers[event.event_type]:
            handler(event)

    def reset(self) -> None:
        """Test-only: clears all registrations so a test session can
        re-register handlers deterministically without accumulating
        duplicates across repeated app-factory calls."""
        self._handlers.clear()


bus = DomainEventBus()
