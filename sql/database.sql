CREATE DATABASE kampus;
USE kampus;

CREATE TABLE jurusan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_jurusan VARCHAR(100)
);

CREATE TABLE mahasiswa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100),
    angkatan INT,
    jurusan_id INT,
    FOREIGN KEY (jurusan_id) REFERENCES jurusan(id)
);

INSERT INTO jurusan (nama_jurusan) VALUES
('Sistem Informasi'),
('Informatika');

INSERT INTO mahasiswa (nama, angkatan, jurusan_id) VALUES
('Andi', 2022, 1),
('Budi', 2021, 2);