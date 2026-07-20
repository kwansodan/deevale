from abc import ABC, abstractmethod


class ChannelAdapter(ABC):
    @abstractmethod
    def deliver(self, user, notification, delivery, context: dict) -> None: ...
