"""phase2_schema

Revision ID: 2026_09_21_p2
Revises: 
Create Date: 2026-09-21 13:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2026_09_21_p2'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pressure Windows
    op.create_table(
        'pressure_windows',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('window_start', sa.Date(), nullable=False),
        sa.Column('window_end', sa.Date(), nullable=False),
        sa.Column('total_due', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('pressure_score', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('contributing_factors', sa.JSON(), nullable=False),
        sa.Column('computed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pressure_windows_user_id'), 'pressure_windows', ['user_id'], unique=False)

    # Loan Simulations
    op.create_table(
        'loan_simulations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('loan_amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('new_emi', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('duration_months', sa.SmallInteger(), nullable=True),
        sa.Column('ratio_before', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('ratio_after', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_loan_simulations_user_id'), 'loan_simulations', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_loan_simulations_user_id'), table_name='loan_simulations')
    op.drop_table('loan_simulations')
    op.drop_index(op.f('ix_pressure_windows_user_id'), table_name='pressure_windows')
    op.drop_table('pressure_windows')
