from typing import List, Optional, Dict, Any
from sqlalchemy import (
    create_engine, Column, Integer, String, Date, ForeignKey, Text
)
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from sqlalchemy.pool import StaticPool
from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict

# ---------- БАЗА ----------
Base = declarative_base()

# Конфигурация БД
DATABASE_URL = "postgresql+psycopg2://user_10:password10@10.115.0.67:5432/edu_practice01_10"

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)


# ---------- МОДЕЛИ SQLAlchemy ----------

class Book(Base):
    __tablename__ = "book"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    author = Column(String(100), nullable=False)
    genre = Column(String(50), nullable=True)
    count = Column(Integer, default=1, nullable=False)
    status = Column(String(20), default="available", nullable=False)

    issues = relationship("BookIssue", back_populates="book")

class Reader(Base):
    __tablename__ = "reader"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    registration_date = Column(Date, default=date.today)
    status = Column(String(20), default="active")

    issues = relationship("BookIssue", back_populates="reader")

class BookIssue(Base):
    __tablename__ = "book_issue"
    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("book.id"), nullable=False)
    reader_id = Column(Integer, ForeignKey("reader.id"), nullable=False)
    issue_date = Column(Date, default=date.today)
    planned_return_date = Column(Date, nullable=False)
    actual_return_date = Column(Date, nullable=True)
    status = Column(String(20), default="issued")  # issued, returned, overdue

    book = relationship("Book", back_populates="issues")
    reader = relationship("Reader", back_populates="issues")

# ---------- Pydantic СХЕМЫ ----------

class BookBase(BaseModel):
    name: str
    author: str
    genre: Optional[str] = None
    count: int = 1


class BookCreate(BookBase):
    pass


class BookUpdate(BookBase):
    pass


class BookOut(BookBase):
    id: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class ReaderBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class ReaderCreate(ReaderBase):
    pass


class ReaderUpdate(ReaderBase):
    status: Optional[str] = "active"


class ReaderOut(ReaderBase):
    id: int
    registration_date: date
    status: str
    books_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class BookIssueBase(BaseModel):
    book_id: int
    reader_id: int
    planned_return_date: date


class BookIssueCreate(BookIssueBase):
    pass


class BookIssueStatus(str, Enum):
    ISSUED = "issued"
    RETURNED = "returned"
    OVERDUE = "overdue"  # Добавлен статус "просрочено"


class BookIssueOut(BookIssueBase):
    id: int
    issue_date: date
    actual_return_date: Optional[date] = None
    status: str
    book_name: Optional[str] = None
    reader_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- STORES ----------

class BookStore:
    def list_books(self, db: Session) -> List[BookOut]:
        books = db.query(Book).all()
        return [BookOut.model_validate(book) for book in books]

    def get_book(self, db: Session, book_id: int) -> Optional[BookOut]:
        book = db.query(Book).filter(Book.id == book_id).first()
        return BookOut.model_validate(book) if book else None

    def create_book(self, db: Session, book_data: BookCreate) -> BookOut:
        db_book = Book(**book_data.model_dump())
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        return BookOut.model_validate(db_book)

    def update_book(self, db: Session, book_id: int, book_data: BookUpdate) -> Optional[BookOut]:
        book = db.query(Book).filter(Book.id == book_id).first()
        if not book:
            return None

        for key, value in book_data.model_dump().items():
            setattr(book, key, value)

        db.commit()
        db.refresh(book)
        return BookOut.model_validate(book)

    def delete_book(self, db: Session, book_id: int) -> bool:
        book = db.query(Book).filter(Book.id == book_id).first()
        if not book:
            return False

        db.delete(book)
        db.commit()
        return True


class ReaderStore:
    def list_readers(self, db: Session) -> List[ReaderOut]:
        readers = db.query(Reader).all()
        result = []

        for reader in readers:
            books_count = db.query(BookIssue).filter(
                BookIssue.reader_id == reader.id,
                BookIssue.status == "issued"
            ).count()

            # Создаем словарь с данными читателя
            reader_dict = {
                "id": reader.id,
                "full_name": reader.full_name,
                "phone": reader.phone,
                "email": reader.email,
                "address": reader.address,
                "registration_date": reader.registration_date,
                "status": reader.status,
                "books_count": books_count
            }
            result.append(ReaderOut(**reader_dict))

        return result

    def create_reader(self, db: Session, reader_data: ReaderCreate) -> ReaderOut:
        db_reader = Reader(**reader_data.model_dump())
        db.add(db_reader)
        db.commit()
        db.refresh(db_reader)
        return ReaderOut.model_validate(db_reader)

    def update_reader(self, db: Session, reader_id: int, reader_data: ReaderUpdate) -> Optional[ReaderOut]:
        reader = db.query(Reader).filter(Reader.id == reader_id).first()
        if not reader:
            return None

        for key, value in reader_data.model_dump().items():
            setattr(reader, key, value)

        db.commit()
        db.refresh(reader)
        return ReaderOut.model_validate(reader)

    def delete_reader(self, db: Session, reader_id: int) -> bool:
        reader = db.query(Reader).filter(Reader.id == reader_id).first()
        if not reader:
            return False

        db.delete(reader)
        db.commit()
        return True


class BookIssueStore:
    def list_issues(self, db: Session) -> List[BookIssueOut]:
        issues = db.query(BookIssue).all()
        result = []

        for issue in issues:
            issue_dict = {
                "id": issue.id,
                "book_id": issue.book_id,
                "reader_id": issue.reader_id,
                "issue_date": issue.issue_date,
                "planned_return_date": issue.planned_return_date,
                "actual_return_date": issue.actual_return_date,
                "status": issue.status,
                "book_name": f"{issue.book.name} - {issue.book.author}" if issue.book else "Unknown",
                "reader_name": issue.reader.full_name if issue.reader else "Unknown"
            }
            result.append(BookIssueOut(**issue_dict))

        return result

    def issue_book(self, db: Session, issue_data: BookIssueCreate) -> BookIssueOut:
        # Проверяем доступность книги
        book = db.query(Book).filter(Book.id == issue_data.book_id).first()
        if not book or book.count <= 0:
            raise ValueError("Книга недоступна для выдачи")

        # Создаем запись о выдаче
        db_issue = BookIssue(**issue_data.model_dump())
        db.add(db_issue)

        # Обновляем количество книг
        book.count -= 1
        if book.count == 0:
            book.status = "issued"

        db.commit()
        db.refresh(db_issue)

        # Создаем ответ
        result = BookIssueOut.model_validate(db_issue)
        result.book_name = f"{book.name} - {book.author}"
        result.reader_name = db_issue.reader.full_name if db_issue.reader else "Unknown"

        return result

    def return_book(self, db: Session, issue_id: int) -> bool:
        issue = db.query(BookIssue).filter(BookIssue.id == issue_id).first()
        if not issue or issue.status == "returned":
            return False

        issue.status = "returned"
        issue.actual_return_date = date.today()

        # Возвращаем книгу в фонд
        book = db.query(Book).filter(Book.id == issue.book_id).first()
        if book:
            book.count += 1
            if book.count > 0:
                book.status = "available"

        db.commit()
        return True

    def check_overdue_issues(self, db: Session):
        """Проверяет и обновляет статусы просроченных выдач"""
        try:
            # Получаем все активные выдачи
            issues = db.query(BookIssue).filter(BookIssue.status == "issued").all()
            today = date.today()

            updated_count = 0
            for issue in issues:
                if issue.planned_return_date < today:
                    issue.status = "overdue"
                    updated_count += 1

            if updated_count > 0:
                db.commit()
                print(f"✅ Обновлено {updated_count} просроченных выдач")

            return updated_count
        except Exception as e:
            db.rollback()
            print(f"❌ Ошибка проверки просрочек: {e}")
            return 0

    def mark_issue_overdue(self, db: Session, issue_id: int):
        """Принудительно отметить выдачу как просроченную"""
        try:
            issue = db.query(BookIssue).filter(BookIssue.id == issue_id).first()
            if not issue:
                return False

            if issue.status != "issued":
                return False

            issue.status = "overdue"
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"❌ Ошибка отметки просрочки: {e}")
            return False

# ---------- Экземпляры ----------
book_store = BookStore()
reader_store = ReaderStore()
book_issue_store = BookIssueStore()