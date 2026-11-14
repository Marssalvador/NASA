"""Live PostgreSQL checks for PostgresRepository. Skipped unless AEGIS_DATABASE_URL is set.

Point it at a development database (never production): it reads the synthetic A-112 record and
verifies that RLS hides it from a user without a grant.
"""
import os
import uuid
import pytest

DSN = os.environ.get('AEGIS_DATABASE_URL')
pytestmark = pytest.mark.skipif(not DSN, reason='AEGIS_DATABASE_URL not set: live database checks skipped')


def test_service_reads_synthetic_record_and_rls_hides_it_from_strangers():
    from backend.aegis.medical import synthetic
    from backend.aegis.medical.repository import AccessDenied, PostgresRepository
    repo = PostgresRepository(DSN)
    profile = repo.profile_by_id(synthetic.A112)
    assert profile.code == 'A-112' and profile.is_synthetic
    assert len(repo.observations(synthetic.A112)) >= 796
    stranger = str(uuid.uuid4())
    assert repo.accessible(stranger) == []
    with pytest.raises(AccessDenied):
        repo.profile('A-112', stranger)
