module.exports = {
    blocks: {
        setMotor: '[M] pr�dko�� silnika [N]',
        stopMotors: 'zatrzymaj silniki',
        move: 'jed�[N]',
        moveWithSpeed: 'jed�[N] z pr�dko�ci� [S]',
        moveWithTime: 'jed�[N] przez [S]s',
        turn: 'skr�� [N]',
        turnWithSpeed: 'skr�� [N] z pr�dko�ci� [S]',
        turnWithTime: 'skr�caj [N] przez [S]s',
        arc: 'jed� po okr�gu o promieniu [R] k�t [A]',
        setOdomoter: 'wsp�rz�dne licznika [N] x: [O] y: [P]',
        leds: 'diody LED [L] R: [R] G: [G] B: [B]',
        setLeds: 'ustaw [L] diody LED na kolor [C]',
        changeLeds: 'zmie� [L] diody LED na kolor poprzez [C]',
        clearLeds: 'wy��cz diody LED',
        nextDial: 'nast�pna dioda LED na okr�gu po stronie [L]',
        ledsCircle: 'diody LED na okr�gu [A] [B] [C] [D] [E] [F] [G] [H]',
        ledsProxH: 'diody LED poziomych czujnik�w zbli�eniowych [A] [B] [C] [D] [E] [F] [G] [H]',
        ledsProxV: 'diody LED czujnik�w pod�o�a [A] [B]',
        ledsButtons: 'diody LED przycisk�w [A] [B] [C] [D]',
        ledsTemperature: 'temperatura diod LED R: [A] B: [B]',
        ledsRc: 'dioda LED zdalnego sterowania [A]',
        ledsSound: 'dioda LED mikrofonu [A]',
        soundSystem: 'odtw�rz d�wi�k systemowy [S]',
        soundFreq: 'odtw�rz notatk� z cz�stotliwo�ci� [N]Hz przez [S]s',
        soundPlaySd: 'odtw�rz d�wi�k z karty SD [N]',
        soundRecord: 'nagrywanie d�wi�ku [N]',
        stopSoundRecord: 'zatrzymaj nagrywanie d�wi�ku',
        soundReplay: 'powt�rz d�wi�k [N]',
        whenButton: 'kiedy przycisk [B] naci�ni�ty',
        touching: 'gdy obiekt wykryty [S]',
        notouching: 'gdy nie wykryto obiektu [S]',
        touchingThreshold: 'gdy obiekt wykryty [S] [N]',
        bump: 'gdy zostanie wykryty wstrz�s',
        soundDetected: 'gdy zostanie wykryty d�wi�k',
        valButton: 'przycisk [B]',
        proximity: 'poziomy czujnik zbli�eniowy [N]',
        proxHorizontal: 'wy�wietl wszystkie poziome czujniki zbli�eniowe',
        ground: 'czujnik pod�o�a [N]',
        proxGroundDelta: 'wy�wietl wszystkie czujniki pod�o�a',
        distance: 'dystans [S]',
        angle: 'k�t [S]',
        tilt: 'nachylenie na [T]',
        micIntensity: 'nat�enie d�wi�ku',
        odometer: 'licznik [O]',
        motor: 'pr�dko�� silnika [M]'
    },
    menus: {
        leftrightall: {
            left: 'lewy',
            right: 'prawy',
            all: 'wszystkie'
        },
        leftright: {
            left: 'lewy',
            right: 'prawy'
        },
        sensors: {
            front: 'przedni',
            back: 'tylny',
            ground: 'dolny'
        },
        sensors2: {
            left: 'lewy',
            front: 'przedni',
            right: 'prawy',
            back: 'tylny',
            ground: 'dolny'
        },
        proxsensors: {
            front_far_left: 'lewy',
            front_left: 'centralny lewy',
            front_center: 'centralny',
            front_right: 'centralny prawy',
            front_far_right: 'prawy',
            back_left: 'tylny lewy',
            back_right: 'tylny prawy'
        },
        horizontalSensors: {
            front_far_left: 'lewy',
            front_left: 'centralny lewy',
            front_center: 'centralny',
            front_right: 'centralny prawy',
            front_far_right: 'prawy',
            back_left: 'tylny lewy',
            back_right: 'tylny prawy'
        },
        groundSensors: {
            left: 'lewy',
            right: 'prawy'
        },
        light: {
            all: 'wszystkie',
            top: 'g�rne',
            bottom: 'dolne',
            bottom_left: 'dolne lewe',
            bottom_right: 'dolne prawe'
        },
        angles: {
            front: 'przedni',
            back: 'tylny',
            ground: 'dolny'
        },
        odo: {
            direction: 'kierunek',
            x: 'x',
            y: 'y'
        },
        tilts: {
            front_back: 'prz�d-ty�',
            top_bottom: 'g�ra-d�',
            left_right: 'lewo-prawo'
        },
        buttons: {
            center: '�rodkowy',
            front: 'naprz�d',
            back: 'do ty�u',
            left: 'w lewo',
            right: 'w prawo'
        },
        nearfar: {
            near: 'blisko',
            far: 'daleko'
        }
    }
};
