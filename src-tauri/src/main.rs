// Evita la consola en Windows en builds de producción.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    frame_lib::run()
}
