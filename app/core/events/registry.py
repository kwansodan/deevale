from app.core.events.bus import DomainEventBus


def register_all(bus: DomainEventBus) -> None:
    """Wires every domain's event handlers onto the bus. Called once from
    create_app(), after all blueprints are registered, so handler modules can
    freely import models from any domain without circular-import issues.
    """
    from app.notifications import handlers as notification_handlers
    from app.partners import handlers as partner_handlers
    from app.referrals import handlers as referral_handlers
    from app.workflow import handlers as workflow_handlers

    workflow_handlers.register(bus)
    notification_handlers.register(bus)
    partner_handlers.register(bus)
    referral_handlers.register(bus)
