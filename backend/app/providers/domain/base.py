from abc import ABC, abstractmethod
from typing import Any, Dict, List


class DomainProvider(ABC):

    @abstractmethod
    def verify_credentials(
        self,
    ) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def find_zone(
        self,
        domain: str,
    ) -> Dict[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def list_dns_records(
        self,
        zone_id: str,
        *,
        name: str | None = None,
        record_type: str | None = None,
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def create_txt_record(
        self,
        zone_id: str,
        *,
        name: str,
        content: str,
    ) -> Dict[str, Any]:
        raise NotImplementedError
