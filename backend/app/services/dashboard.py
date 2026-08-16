from app.repositories.dashboard import DashboardRepository


class DashboardService:
    def __init__(self, connection=None):
        self.repo = DashboardRepository(connection)

    def overview(self):
        return {
            "summary": self.repo.summary(),
            "action_required": self.repo.action_required(),
            "recent_bookings": self.repo.recent_bookings(),
            "upcoming_operations": self.repo.upcoming_operations(),
        }

    def summary(self):
        return self.repo.summary()

    def action_required(self):
        return self.repo.action_required()

    def recent_bookings(self, limit=20):
        return self.repo.recent_bookings(limit)

    def upcoming_operations(self, limit=20):
        return self.repo.upcoming_operations(limit)
