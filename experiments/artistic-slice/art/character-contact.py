"""Échantillonner les semelles skinnées de deux GLB source, avant compression Web."""

import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import numpy as np


COMPONENT_TYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
COMPONENT_COUNTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
CHANNELS = {'translation': 0, 'rotation': 1, 'scale': 2}
REQUIRED_CLIPS = ['Idle', 'Walk', 'Run', 'Turn', 'Interact', 'Dialogue']


class Glb:
    def __init__(self, path):
        self.path = path
        self.raw = path.read_bytes()
        magic, version, length, json_length, chunk = struct.unpack_from('<4s4I', self.raw)
        assert (magic, version, length, chunk) == (b'glTF', 2, len(self.raw), 0x4E4F534A)
        self.gltf = json.loads(self.raw[20:20 + json_length])
        self.binary = self.raw[28 + json_length:]

    def accessor(self, index):
        accessor = self.gltf['accessors'][index]
        view = self.gltf['bufferViews'][accessor['bufferView']]
        assert not view.get('extensions'), 'Utiliser les fichiers non comprimés produits par Blender.'
        dtype = np.dtype(COMPONENT_TYPES[accessor['componentType']])
        columns = COMPONENT_COUNTS[accessor['type']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        strides = (view.get('byteStride', dtype.itemsize * columns), dtype.itemsize)
        data = np.ndarray((accessor['count'], columns), dtype=dtype,
                          buffer=self.binary, offset=offset, strides=strides)
        if accessor.get('normalized'):
            return data.astype(float) / np.iinfo(dtype).max
        return data


def transform(translation, rotation, scale):
    x, y, z, w = rotation
    matrix = np.eye(4)
    matrix[:3, :3] = [
        [1 - 2 * (y*y + z*z), 2 * (x*y - w*z), 2 * (x*z + w*y)],
        [2 * (x*y + w*z), 1 - 2 * (x*x + z*z), 2 * (y*z - w*x)],
        [2 * (x*z - w*y), 2 * (y*z + w*x), 1 - 2 * (x*x + y*y)],
    ]
    matrix[:3, :3] *= scale
    matrix[:3, 3] = translation
    return matrix


def interpolate(times, values, t, rotation, mode):
    if t <= times[0]:
        value = values[0]
    elif t >= times[-1]:
        value = values[-1]
    elif mode == 'STEP':
        value = values[np.searchsorted(times, t, side='right') - 1]
    else:
        right = np.searchsorted(times, t)
        fraction = (t - times[right - 1]) / (times[right] - times[right - 1])
        first, second = values[right - 1], values[right]
        if rotation:
            cosine = first.dot(second).item()
            if cosine < 0:
                second, cosine = -second, -cosine
            if cosine < .9995:
                angle = np.arccos(cosine)
                return (first * np.sin((1 - fraction) * angle) + second * np.sin(fraction * angle)) / np.sin(angle)
        value = first + (second - first) * fraction
    if rotation:
        return value / np.linalg.norm(value)
    return value


def inspect(path, samples):
    model = Glb(path)
    data = model.gltf
    skin, = data['skins']
    joints = skin['joints']
    inverse = model.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    nodes = data['nodes']
    parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
    defaults = [
        (node.get('translation', [0, 0, 0]), node.get('rotation', [0, 0, 0, 1]), node.get('scale', [1, 1, 1]))
        for node in nodes
    ]
    primitives = [primitive for mesh in data['meshes'] for primitive in mesh['primitives']]
    keys = {'POSITION', 'TEXCOORD_0', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0'}
    assert all(keys.issubset(primitive['attributes']) for primitive in primitives)

    def attribute(name):
        return np.concatenate([model.accessor(p['attributes'][name]) for p in primitives])

    position = attribute('POSITION')
    weights = attribute('WEIGHTS_0')
    assert np.allclose(weights.sum(1), 1, atol=.00001)
    assert abs(position[:, 1].min()) < .0001
    soles = np.flatnonzero(np.abs(position[:, 1]) < .0001)
    left = position[soles, 0] > 0
    right = position[soles, 0] < 0
    assert left.any() and right.any()
    feet = np.column_stack([position[soles], np.ones(len(soles))])
    weights = weights[soles]
    joint_indices = attribute('JOINTS_0')[soles]

    def measure(channels, t):
        local = [list(trs) for trs in defaults]
        for node, channel, times, values, mode in channels:
            local[node][CHANNELS[channel]] = interpolate(times, values, t, channel == 'rotation', mode)
        matrices = {}

        def world(i):
            if i not in matrices:
                matrix = (np.array(nodes[i]['matrix']).reshape(4, 4).T
                          if 'matrix' in nodes[i] else transform(*local[i]))
                matrices[i] = world(parents[i]) @ matrix if i in parents else matrix
            return matrices[i]

        skinning = np.stack([world(i) for i in joints]) @ inverse
        pose = np.einsum('nqij,nj->nqi', skinning[joint_indices], feet)
        pose = np.einsum('nqi,nq->ni', pose, weights)
        return min(pose[left, 1].min(), pose[right, 1].min()).item()

    clips = []
    assert [animation['name'] for animation in data['animations']] == REQUIRED_CLIPS
    for animation in data['animations']:
        channels = []
        for channel in animation['channels']:
            sampler = animation['samplers'][channel['sampler']]
            mode = sampler.get('interpolation', 'LINEAR')
            assert mode in {'LINEAR', 'STEP'}
            target = channel['target']
            channels.append((target['node'], target['path'], model.accessor(sampler['input']).ravel(),
                             model.accessor(sampler['output']), mode))
        time = max(times[-1].item() for _, _, times, _, _ in channels)
        ground = [measure(channels, t) for t in np.linspace(0, time, samples)]
        clips.append({
            'clip': animation['name'],
            'durationSeconds': round(time, 5),
            'channels': len(channels),
            'minimumSoleYMeters': round(min(ground), 6),
            'highestBothSolesYMeters': round(max(ground), 6),
        })
    return {
        'file': path.name,
        'sourceBytes': len(model.raw),
        'sourceSha256': hashlib.sha256(model.raw).hexdigest(),
        'glTFVertices': len(position),
        'triangles': sum(data['accessors'][p['indices']]['count'] // 3 for p in primitives),
        'heightMeters': round(position[:, 1].max().item(), 6),
        'restMinimumYMeters': round(position[:, 1].min().item(), 6),
        'joints': len(joints),
        'materials': len(data['materials']),
        'embeddedImages': len(data['images']),
        'normalMappedMaterials': sum('normalTexture' in m for m in data['materials']),
        'soleVertices': len(soles),
        'clips': clips,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='Répertoire des deux GLB Blender non comprimés')
    parser.add_argument('--samples', type=int, default=91)
    parser.add_argument('--repeat', type=Path, help='Répertoire d’une seconde génération Blender indépendante')
    parser.add_argument('--portrait-reference', type=Path, help='Portrait WebP conservé dans le paquet de prévisualisation')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    options = parser.parse_args(argv)
    if options.samples < 2:
        parser.error('Compter au moins deux instants par clip.')
    result = {
        'sampling': {
            'space': 'glTF, repos au sol à Y = 0 et avant +Z',
            'input': 'GLB source Blender non comprimés',
            'samplesPerClip': options.samples,
            'interpolation': 'STEP ou LINEAR selon le canal, interpolation sphérique pour les rotations LINEAR',
            'soleDefinition': 'Sommets au repos à moins de 0,1 mm du plan Y = 0, skinnés par le squelette',
        },
        'characters': [inspect(options.directory / f'{key}.glb', options.samples) for key in ('avatar', 'antoine')],
    }
    if options.repeat:
        result['reproducibility'] = {
            f'{key}.glb': (options.repeat / f'{key}.glb').read_bytes() == (options.directory / f'{key}.glb').read_bytes()
            for key in ('avatar', 'antoine')
        }
        if options.portrait_reference:
            portrait = (options.repeat / 'antoine.webp').read_bytes()
            result['reproducibility']['antoine.webp'] = {
                'byteIdentical': portrait == options.portrait_reference.read_bytes(),
                'sha256': hashlib.sha256(portrait).hexdigest(),
            }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
